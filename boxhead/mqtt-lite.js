/* 极简 MQTT 3.1.1 over WebSocket 客户端
   目的：不引第三方库，只做 qos0 的「发一条 / 收一条」。
   公共 broker 匿名可用：
     wss://broker.emqx.io:8084/mqtt
     wss://broker.hivemq.com:8884/mqtt
   用法：
     const c = new MqttLite('wss://broker.emqx.io:8084/mqtt', 'de-' + rand());
     await c.connect();
     await c.subscribe('topic/x', (bytes) => {...});
     c.publish('topic/x', payload);
*/
(function (global) {
  'use strict';

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [];
    for (var i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 0xff);
    return new Uint8Array(out);
  }

  function varint(n) {
    var out = [];
    do {
      var b = n % 128;
      n = Math.floor(n / 128);
      if (n > 0) b |= 0x80;
      out.push(b);
    } while (n > 0);
    return out;
  }

  function MqttLite(url, clientId) {
    this.url = url;
    this.clientId = clientId || ('ml' + Math.random().toString(36).slice(2, 10));
    this.ws = null;
    this.buf = new Uint8Array(0);
    this.subs = {};        // topic -> [cb]
    this.pid = 1;
    this.pingTimer = null;
    this.onclose = null;
  }

  MqttLite.prototype.connect = function (timeoutMs) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () {
        if (!done) { done = true; reject(new Error('connect timeout')); }
      }, timeoutMs || 12000);

      var ws;
      try { ws = new WebSocket(self.url, 'mqtt'); }
      catch (e) { clearTimeout(t); return reject(e); }
      ws.binaryType = 'arraybuffer';
      self.ws = ws;

      ws.onopen = function () {
        // CONNECT
        var body = [];
        body.push(0x00, 0x04, 0x4d, 0x51, 0x54, 0x54);  // "MQTT"
        body.push(0x04);                                 // level 4
        body.push(0x02);                                 // clean session
        body.push(0x00, 0x3c);                           // keepalive 60s
        var cid = utf8(self.clientId);
        body.push((cid.length >> 8) & 0xff, cid.length & 0xff);
        for (var i = 0; i < cid.length; i++) body.push(cid[i]);
        ws.send(new Uint8Array([0x10].concat(varint(body.length), body)));
      };

      ws.onmessage = function (ev) {
        var data = new Uint8Array(ev.data);
        var old = self.buf;
        var merged = new Uint8Array(old.length + data.length);
        merged.set(old, 0);
        merged.set(data, old.length);
        self.buf = merged;
        self._drain();

        if (!self.connected) {
          self.connected = true;
          self._keepalive();
          if (!done) { done = true; clearTimeout(t); resolve(self); }
        }
      };

      ws.onerror = function () {
        if (!done) { done = true; clearTimeout(t); reject(new Error('ws error')); }
      };
      ws.onclose = function () {
        self.connected = false;
        if (self.pingTimer) clearInterval(self.pingTimer);
        if (self.onclose) self.onclose();
        if (!done) { done = true; clearTimeout(t); reject(new Error('ws closed')); }
      };
    });
  };

  MqttLite.prototype._keepalive = function () {
    var self = this;
    if (self.pingTimer) return;
    self.pingTimer = setInterval(function () {
      try { self.ws.send(new Uint8Array([0xc0, 0x00])); } catch (e) {}
    }, 30000);
  };

  /* 从缓冲区里不断切出完整包 */
  MqttLite.prototype._drain = function () {
    var self = this;
    for (;;) {
      var b = self.buf;
      if (b.length < 2) return;
      // 解析 remaining length
      var mul = 1, len = 0, i = 1, ok = false;
      while (i < b.length) {
        var d = b[i++];
        len += (d & 0x7f) * mul;
        mul *= 128;
        if ((d & 0x80) === 0) { ok = true; break; }
        if (mul > 128 * 128 * 128) return;
      }
      if (!ok) return;
      var total = i + len;
      if (b.length < total) return;
      var type = (b[0] >> 4) & 0x0f;
      var body = b.subarray(i, total);
      self.buf = b.subarray(total);

      if (type === 3) {            // PUBLISH
        var tl = (body[0] << 8) | body[1];
        var topic = '';
        for (var k = 0; k < tl; k++) topic += String.fromCharCode(body[2 + k]);
        var payload = body.subarray(2 + tl);
        var qos = (b[0] >> 1) & 0x03;
        var off = 2 + tl + (qos > 0 ? 2 : 0);
        payload = body.subarray(off);
        var list = self.subs[topic];
        if (list) for (var j = 0; j < list.length; j++) {
          try { list[j](payload); } catch (e) {}
        }
      }
      // 其他类型（CONNACK/SUBACK/PINGRESP）忽略
    }
  };

  MqttLite.prototype.subscribe = function (topic, cb) {
    (this.subs[topic] = this.subs[topic] || []).push(cb);
    var t = utf8(topic);
    var pid = (this.pid++) & 0xffff;
    var body = [pid >> 8, pid & 0xff];
    body.push((t.length >> 8) & 0xff, t.length & 0xff);
    for (var i = 0; i < t.length; i++) body.push(t[i]);
    body.push(0x00);   // qos0
    this.ws.send(new Uint8Array([0x82].concat(varint(body.length), body)));
  };

  MqttLite.prototype.publish = function (topic, payload) {
    var t = utf8(topic);
    var p = payload instanceof Uint8Array ? payload : utf8(String(payload));
    var body = [(t.length >> 8) & 0xff, t.length & 0xff];
    for (var i = 0; i < t.length; i++) body.push(t[i]);
    var head = new Uint8Array([0x30].concat(varint(body.length + p.length), body));
    var pkt = new Uint8Array(head.length + p.length);
    pkt.set(head, 0);
    pkt.set(p, head.length);
    try { this.ws.send(pkt); return true; } catch (e) { return false; }
  };

  MqttLite.prototype.close = function () {
    try { this.ws.send(new Uint8Array([0xe0, 0x00])); } catch (e) {}
    try { this.ws.close(); } catch (e) {}
  };

  global.MqttLite = MqttLite;
})(window);
