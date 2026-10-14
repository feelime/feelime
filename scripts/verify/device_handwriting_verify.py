#!/usr/bin/env python3
"""Real ORT cold/warm recognition, lifecycle release, and native crash export.

Requires a debug APK, FEELIME_ADB_SERIAL, and websocket-client. Uses only the
SetupActivity fixture editor. The SIGABRT is deliberate diagnostic validation,
not a reproduction of a reported user crash. --skip-crash omits that phase.
"""
import argparse
import base64
import hashlib
import json
import re
import shlex
import subprocess
import time
import urllib.request
import xml.etree.ElementTree as ET

import websocket
import device_verify as d
from diagnostic_trace import wire_fields


def wait_until(check, label, seconds=15):
    until = time.monotonic() + seconds
    while time.monotonic() < until:
        result = check()
        if result:
            return result
        time.sleep(0.1)
    raise AssertionError('timeout: ' + label)


class Page:
    def __init__(self):
        d._dt_connect()
        pages = json.load(urllib.request.urlopen('http://127.0.0.1:' + d.DEVTOOLS_PORT + '/json', timeout=10))
        page = next(p for p in reversed(pages) if p.get('title') == 'Feelime Keyboard' and d._attached_target(p))
        self.ws = websocket.create_connection(page['webSocketDebuggerUrl'], suppress_origin=True, timeout=20)
        self.seq = 0

    def call(self, method, params):
        self.seq += 1
        self.ws.send(json.dumps({'id': self.seq, 'method': method, 'params': params}))
        while True:
            response = json.loads(self.ws.recv())
            if response.get('id') == self.seq:
                assert 'error' not in response, response.get('error')
                return response['result']

    def eval(self, expression):
        result = self.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
        assert 'exceptionDetails' not in result, result.get('exceptionDetails')
        return result['result'].get('value')

    def close(self):
        self.ws.close()


def setup_probe():
    page = Page()
    page.eval("window.FeelimeNative.selectMode('handwriting',window.Feelime.debugState().token); true")
    wait_until(lambda: page.eval('window.Feelime.debugState().mode') == 'handwriting', 'handwriting mode')
    # Handwriting changes view height. Refresh physical offsets after resize.
    d._DT_PID = None
    d._dt_connect()
    page.eval("window.__inkAudit=[]; window.__inkOriginal=window.Feelime.onInkCandidates; "
              "window.Feelime.onInkCandidates=p=>{window.__inkAudit.push(p);window.__inkOriginal(p)}; true")
    return page


def request(page, req, payload):
    assert page.eval(f'window.FeelimeNative.recognizeInk({req},{json.dumps(payload)},window.Feelime.debugState().token); true') is True


def result(page, req):
    return wait_until(lambda: page.eval(f'window.__inkAudit.find(p=>p.reqId==={req})'), 'ink result ' + str(req), 30)


def check_ok(response):
    assert response['error'] is None and len(response['candidates']) == 8, response
    assert all(isinstance(c['score'], (int, float)) and 0 <= c['score'] <= 1 for c in response['candidates']), response


def log():
    return d.shell(f'run-as {d.PKG} cat no_backup/diag-events.log')


def use_default_model_choice():
    name = 'feelime_asr.xml'
    if name not in d.shell(f'run-as {d.PKG} ls shared_prefs').split():
        return None, None
    raw = d.adb('exec-out', 'run-as', d.PKG, 'cat', 'shared_prefs/' + name)
    root = ET.fromstring(raw)
    choice = next((e for e in root if e.attrib.get('name') == 'model_backend'), None)
    if choice is None:
        return None, None
    previous = choice.text
    root.remove(choice)
    return previous, ET.tostring(root, encoding='utf-8', xml_declaration=True)


def write_model_choice(replacement):
    path = 'shared_prefs/feelime_asr.xml'
    checksum = hashlib.sha256(replacement).hexdigest()
    transaction = f"cat > {path}.tmp && printf '%s  %s\\n' {checksum} {path}.tmp | sha256sum -c - >/dev/null && mv {path}.tmp {path}"
    command = f'run-as {d.PKG} sh -c ' + shlex.quote(transaction)
    subprocess.run(['adb', '-s', d.SERIAL, 'shell', command], input=replacement, check=True, capture_output=True)



def verify_java_capture():
    pid = int(d.shell(f'pidof {d.PKG}').strip().split()[0])
    marker = 'java-crash-probe-' + str(time.time_ns())
    assert d.devtools_eval(f'window.FeelimeNative.diagEvent({json.dumps(marker)},window.Feelime.debugState().token); true') is True
    # Some Android builds implement `am crash` as native SIGTRAP. Request an
    # actual main-thread Java exception through the debug-only fixture.
    d.shell(f'am start -n {d.PKG}/com.feelime.ime.SetupActivity --ez com.feelime.ime.extra.DEBUG_JAVA_CRASH true')
    wait_until(lambda: str(pid) not in d.shell(f'pidof {d.PKG}').split(), 'controlled Java crash exit')
    evidence = log().split(marker, 1)[-1]
    assert ' javaCrash ' in evidence and ' javaCrash+ ' in evidence, 'Java crash stack not persisted after enabling diagnostics'
    d.shell(f'am start -n {d.PKG}/com.feelime.ime.SetupActivity')
    wait_until(lambda: d.shell(f'pidof {d.PKG}').strip(), 'restart after Java crash')
    print('PASS diagnostics enabled after startup: Java main-thread crash stack persisted before process exit', flush=True)


def verify_crash_export(pid):
    d.shell(f'run-as {d.PKG} kill -6 {pid}')
    wait_until(lambda: str(pid) not in d.shell(f'pidof {d.PKG}').split(), 'controlled SIGABRT exit')
    # Cold settings export must initialize diagnostics before the IME starts.
    d.shell(f'am force-stop {d.PKG}')
    d.shell(f'am start -n {d.PKG}/com.feelime.ime.SetupActivity')
    ready = "(()=>{try{return typeof Native.exportDiagnostics==='function'&&typeof token==='string'&&token.length>0}catch(_){return false}})()"
    wait_until(lambda: d.devtools_eval_target('settings', ready) is True, 'cold settings bridge')
    exported = d.devtools_eval_target('settings', "Native.exportDiagnostics(token); 'ok'")
    assert exported == 'ok', 'settings export bridge returned ' + repr(exported)
    time.sleep(0.8)
    names = d.shell(f'run-as {d.PKG} ls cache/exports').split()
    name = sorted(n for n in names if n.startswith('feelime-diagnostics-'))[-1]
    report = d.shell(f'run-as {d.PKG} cat cache/exports/{name}')
    pattern = r'--- tombstone (tb-' + str(pid) + r'-\d+\.bin) bytes=(\d+) sha256=([0-9a-f]{64}) truncated=(\S+) base64 ---\n([A-Za-z0-9+/=\n]+)'
    match = re.search(pattern, report)
    assert match, 'new crash artifact missing from cold settings export'
    raw = base64.b64decode(match[5])
    assert len(raw) == int(match[2]) and hashlib.sha256(raw).hexdigest() == match[3], 'artifact integrity mismatch'
    assert match[4] == 'false', 'crash artifact truncated; increase capture budget or inspect device bugreport'
    fields = wire_fields(raw)
    assert fields.get(5) == [pid], 'wrong crash process'
    assert wire_fields(fields[10][0]).get(1) == [6], 'wrong signal'
    assert d.PKG.encode() in fields.get(9, []), 'wrong crash command line'
    frames = []
    for thread_entry in fields.get(16, []):
        thread = wire_fields(wire_fields(thread_entry)[2][0])
        frames += [wire_fields(frame) for frame in thread.get(4, [])]
    assert frames and any(frame.get(6) for frame in frames), 'native backtrace modules missing'
    assert any(frame.get(8) for frame in frames), 'native library Build IDs missing'
    print(f'PASS controlled SIGABRT: complete {len(raw)}B protobuf, PID/signal/native frames/Build IDs/SHA match export', flush=True)


def main(skip_crash):
    d.shell(f'am force-stop {d.PKG}')
    d.prepare()
    # Start the next process with diagnostics OFF, then enable it after
    # service creation, matching the common user activation path.
    assert d.devtools_eval_target('settings', "Native.setDiagnostics(false, token); 'ok'") == 'ok'
    stored_backend, replacement = use_default_model_choice()
    page = None
    try:
        if replacement is not None:
            d.shell(f'am force-stop {d.PKG}')
            write_model_choice(replacement)
        d.shell(f'am force-stop {d.PKG}')
        d.prepare()
        assert d.devtools_eval_target('settings', "Native.setDiagnostics(true, token); 'ok'") == 'ok'
        # No explicit source choice: thin must still see its packaged ink model.
        page = setup_probe()
        payload = json.dumps({'w': 320, 'h': 220, 'strokes': [
            [[80, 60], [230, 60], [230, 160], [80, 160], [80, 60]], [[155, 20], [155, 200]]
        ]})
        marker = 'ink-probe-' + str(time.time_ns())
        page.eval(f'window.FeelimeNative.diagEvent({json.dumps(marker)},window.Feelime.debugState().token); true')
        request(page, 101, payload)
        cold = result(page, 101)
        check_ok(cold)
        # Golden output observed for this exact tensor/model/vocabulary. This
        # checks decoding stability, not the model's handwriting accuracy.
        assert cold['candidates'][0]['text'] == '口' and cold['candidates'][0]['score'] > 0.9, cold
        evidence = log().split(marker, 1)[1]
        for stage in ('session-create', 'options-close', 'input-info', 'output-info', 'output-close', 'tensor-close'):
            assert re.search(r'done .*stage=' + stage + r'(?: |$)', evidence), 'missing completed phase ' + stage
        assert 'outInfoRead n=3755' in evidence, 'real NodeInfo vocabulary validation missing'
        print('PASS cold ORT: actual model -> candidates include 口; metadata, options and inference resources verified', flush=True)

        rect = page.eval("(()=>{const r=document.getElementById('inkCanvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()")
        for stroke in json.loads(payload)['strokes']:
            points = [dict(id=1, x=rect['x'] + x / 320 * rect['w'], y=rect['y'] + y / 220 * rect['h']) for x, y in stroke]
            page.call('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [points[0]]})
            for point in points[1:]:
                page.call('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [point]})
            page.call('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        candidate = wait_until(lambda: page.eval("(()=>{const b=document.querySelector('#candidates .candidate');if(!b)return null;b.scrollIntoView({block:'nearest',inline:'nearest'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,text:b.textContent}})()"), 'visible handwriting candidate', 35)
        req = page.eval('window.Feelime.debugState().inkReqId')
        ui_result = result(page, req)
        check_ok(ui_result)
        assert candidate['text'] == ui_result['candidates'][0]['text'], 'displayed candidate does not match native result'
        px, py = d.devtools_to_screen(candidate['x'], candidate['y'])
        d.tap(px, py, 0.5)
        wait_until(lambda: d.field_text_retry() == candidate['text'], 'handwriting candidate committed to host editor')
        assert page.eval('window.Feelime.debugState().inkStrokes') == 0, 'committed ink was not cleared'
        print('PASS canvas touch -> native ORT -> visible candidate -> real editor commit and ink reset', flush=True)

        request(page, 102, '{}')
        assert result(page, 102)['error'] == 'failed'
        request(page, 103, payload)
        check_ok(result(page, 103))
        assert len(re.findall(r'begin .*stage=session-create', log().split(marker, 1)[1])) == 1, 'warm request unexpectedly reloads model'
        print('PASS warm ORT and invalid payload recovery', flush=True)

        large = json.dumps({'w': 320, 'h': 220, 'strokes': [
            [[80 + i % 80, 60 + (i % 4) * 10] for i in range(100)] for _ in range(8)]})
        assert len(large) > 4096
        request(page, 104, large)
        check_ok(result(page, 104))
        request(page, 105, 'x' * (512 * 1024 + 1))
        assert result(page, 105)['error'] == 'failed'
        print('PASS handwriting-specific payload budget: >4Ki characters accepted, oversize explicitly failed', flush=True)

        page.eval(f'for(let req=200;req<240;req++) window.FeelimeNative.recognizeInk(req,{json.dumps(payload)},window.Feelime.debugState().token); true')
        check_ok(result(page, 239))
        responses = page.eval('window.__inkAudit.filter(p=>p.reqId>=200).length')
        assert responses < 40, 'burst did not coalesce any obsolete requests'
        print(f'PASS burst: latest request delivered; {responses}/40 computed results', flush=True)

        alternatives = [s.strip() for s in d.shell('ime list -s').splitlines() if s.strip() and d.PKG not in s]
        assert alternatives, 'no alternate IME available for service release verification'
        release_marker = 'ink-release-' + str(time.time_ns())
        page.eval(f'window.FeelimeNative.diagEvent({json.dumps(release_marker)},window.Feelime.debugState().token); true')
        d.shell('ime set ' + shlex.quote(alternatives[0]))
        wait_until(lambda: re.search(r'done .*stage=session-close(?: |$)', log().split(release_marker, 1)[-1]), 'native session release')
        page.close()
        page = None
        d.shell('ime set ' + d.IME_SVC)
        d.fresh_kb()
        page = setup_probe()
        request(page, 1, payload)
        check_ok(result(page, 1))
        print('PASS service destroy/recreate: session released, new engine recognizes with reset reqId', flush=True)
        page.close()
        page = None
        if not skip_crash:
            verify_java_capture()
            verify_crash_export(int(d.shell(f'pidof {d.PKG}').strip().split()[0]))
    finally:
        if page:
            page.close()
        if stored_backend:
            d.shell(f'am start -n {d.PKG}/com.feelime.ime.SetupActivity')
            ready = "(()=>{try{return typeof token==='string'&&token.length>0}catch(_){return false}})()"
            wait_until(lambda: d.devtools_eval_target('settings', ready) is True, 'restore settings bridge')
            assert d.devtools_eval_target('settings', f'Native.setModelBackend({json.dumps(stored_backend)},token); "ok"') == 'ok'
        d.shell('ime set ' + d.IME_SVC)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip-crash', action='store_true')
    main(parser.parse_args().skip_crash)
