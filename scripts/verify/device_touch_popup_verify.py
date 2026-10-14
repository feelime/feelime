#!/usr/bin/env python3
"""Crossed touches via CDP Input, physical all-up audit, and incident export.

Requires FEELIME_ADB_SERIAL, a debug APK, and Python websocket-client.
Uses the SetupActivity test editor; does not clear application data.
The missing-end case is explicitly synthetic fault injection.
"""
import json
import time
import urllib.request

import websocket
import device_verify as d


def main():
    d.prepare()
    assert d.devtools_eval_target('settings', "Native.setDiagnostics(true, token); 'ok'") == 'ok'
    time.sleep(0.3)
    d.switch_mode(d.fresh_kb(), '英文 Direct')
    assert d.devtools_eval('window.Feelime.debugState().mode') == 'direct'
    d._dt_connect()
    pages = json.load(urllib.request.urlopen('http://127.0.0.1:' + d.DEVTOOLS_PORT + '/json', timeout=10))
    page = next(p for p in pages if p.get('title') == 'Feelime Keyboard' and d._attached_target(p))
    ws = websocket.create_connection(page['webSocketDebuggerUrl'], suppress_origin=True, timeout=10)
    seq = 0
    active_contacts = set()

    def call(method, params):
        nonlocal seq
        seq += 1
        ws.send(json.dumps({'id': seq, 'method': method, 'params': params}))
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            response = json.loads(ws.recv())
            if response.get('id') == seq:
                assert 'error' not in response, response.get('error')
                return response['result']
        raise RuntimeError('CDP response timeout')

    def evaluate(expression):
        result = call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
        assert 'exceptionDetails' not in result, result.get('exceptionDetails')
        return result['result'].get('value')

    def touch(kind, points):
        call('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': points})
        if kind == 'touchStart':
            active_contacts.update(p['id'] for p in points)
        elif kind == 'touchCancel' or (kind == 'touchEnd' and not points):
            active_contacts.clear()
        elif kind == 'touchEnd':
            active_contacts.difference_update(p['id'] for p in points)

    def empty():
        state = evaluate('window.Feelime.touchState()')
        assert state and not state['popup'] and not state['dom'] and not state['ids'] and state['press'] == 0, state

    try:
        coords = evaluate("['q','h'].map(k=>{const r=document.querySelector('#qwertyLayer [data-key='+k+']').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})")
        a, b = dict(coords[0], id=1), dict(coords[1], id=2)
        for same in (False, True):
            for held in (False, True):
                for owner_first in (False, True):
                    second = dict(coords[0] if same else coords[1], id=2)
                    touch('touchStart', [a])
                    time.sleep(0.03)
                    touch('touchStart', [a, second])
                    time.sleep(0.45 if held else 0.03)
                    state = evaluate('window.Feelime.touchState()')
                    if held:
                        assert state['popup'] and state['dom'], state
                    # This CDP endpoint uses listed points as released contacts.
                    first = a if owner_first else second
                    touch('touchEnd', [first])
                    state = evaluate('window.Feelime.touchState()')
                    assert len(state['ids']) == 1, state
                    touch('touchEnd', [])
                    time.sleep(0.25)
                    empty()
        touch('touchStart', [a])
        time.sleep(0.45)
        touch('touchCancel', [])
        time.sleep(0.25)
        empty()
        print('PASS CDP Input: crossed/same-key touches, both release orders, holds and cancellation', flush=True)

        # Native boundary evidence: CDP Input does not pass DiagWebView's native
        # dispatchTouchEvent. Use real Android input for this independent check.
        px, py = d.devtools_to_screen(a['x'], a['y'])
        marker = 'native-probe-' + str(time.time_ns())
        evaluate(f'window.FeelimeNative.diagEvent({json.dumps(marker)},window.Feelime.debugState().token); true')
        for action in ('DOWN', 'UP'):
            d.shell(f'input touchscreen motionevent {action} {int(px)} {int(py)}')
            time.sleep(0.05)
        time.sleep(0.5)
        normal = d.shell(f'run-as {d.PKG} cat no_backup/diag-events.log')
        assert marker in normal, 'native probe marker missing'
        normal = normal.split(marker, 1)[1]
        assert 'touchN in ' in normal and 'allUp audit-result' in normal, 'native all-up probe missing'
        print('PASS native MotionEvent -> JS all-up audit', flush=True)

        # Drop only the web end at window capture: Android still receives UP.
        # The native audit must preserve this independent evidence, without
        # changing the stuck web press itself.
        marker = 'missing-web-end-probe-' + str(time.time_ns())
        evaluate(f'window.FeelimeNative.diagEvent({json.dumps(marker)},window.Feelime.debugState().token); true')
        evaluate("window.addEventListener('touchend', e=>e.stopImmediatePropagation(), {capture:true, once:true}); true")
        for action in ('DOWN', 'UP'):
            d.shell(f'input touchscreen motionevent {action} {int(px)} {int(py)}')
            time.sleep(0.05)
        time.sleep(0.6)
        state = evaluate('window.Feelime.touchState()')
        assert state['ids'], 'fault injection did not retain a web contact'
        frozen = d.shell(f'run-as {d.PKG} cat no_backup/diag-touch-incident.log')
        assert marker in frozen, 'incident came from an earlier run'
        assert 'native-all-up-residue' in frozen and 'allUp audit-result' in frozen, 'native audit did not freeze residue'
        evaluate('window.Feelime.cancelTouches(); true')
        empty()
        print('PASS native UP with missing web end: read-only audit freezes residue', flush=True)

        marker = 'stalled-web-probe-' + str(time.time_ns())
        evaluate(f'window.FeelimeNative.diagEvent({json.dumps(marker)},window.Feelime.debugState().token); true')
        for action in ('DOWN', 'UP'):
            d.shell(f'input touchscreen motionevent {action} {int(px)} {int(py)}')
        # Stall only the renderer, long enough to miss the native audit reply.
        evaluate('setTimeout(()=>{const end=performance.now()+2200;while(performance.now()<end){}},0); true')
        time.sleep(2.8)
        frozen = d.shell(f'run-as {d.PKG} cat no_backup/diag-touch-incident.log')
        assert marker in frozen and 'native-all-up-no-js-reply' in frozen, 'unresponsive renderer evidence missing'
        empty()
        print('PASS stalled renderer: native audit timeout freezes evidence', flush=True)

        evaluate("window.Feelime.cancelTouches(); window.Feelime.clearEditor(); true")
        # Fault injection: omit A's end, then deliver B's end with no live points.
        assert evaluate("""(() => {
            const q=document.querySelector('#qwertyLayer [data-key=q]');
            const h=document.querySelector('#qwertyLayer [data-key=h]');
            const point=(id,key)=>{const r=key.getBoundingClientRect();return new Touch({identifier:id,target:key,clientX:r.x+r.width/2,clientY:r.y+r.height/2})};
            const a=point(101,q), b=point(102,h);
            const send=(key,type,changed,live)=>key.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,changedTouches:changed,touches:live}));
            send(q,'touchstart',[a],[a]);send(h,'touchstart',[b],[a,b]);send(h,'touchend',[b],[]);
            return true;
        })()""") is True
        time.sleep(0.6)
        empty()
        frozen = d.shell(f'run-as {d.PKG} cat no_backup/diag-touch-incident.log')
        assert 'fault-missing-contact' in frozen and 'touchIncident capture' in frozen, 'incident did not persist'
        evaluate("for(let i=0;i<1100;i++) window.FeelimeNative.diagEvent('retention-test '+i,window.Feelime.debugState().token); true")
        time.sleep(0.5)
        assert 'retention-test 1099' in d.shell(f'run-as {d.PKG} cat no_backup/diag-events.log'), 'rotation pressure did not execute'
        assert d.shell(f'run-as {d.PKG} cat no_backup/diag-touch-incident.log') == frozen, 'subsequent logs overwrote frozen evidence'
        assert d.devtools_eval_target('settings', "Native.exportDiagnostics(token); 'ok'") == 'ok'
        time.sleep(0.6)
        names = d.shell(f'run-as {d.PKG} ls cache/exports').split()
        report = d.shell(f'run-as {d.PKG} cat cache/exports/{sorted(n for n in names if n.startswith("feelime-diagnostics-"))[-1]}')
        assert 'last touch incident' in report and 'fault-missing-contact' in report, 'export omitted incident'
        print('PASS missing-end fault: no late popup; snapshot survives ring rotation and settings export', flush=True)

        # Settings can be the first screen after process death; export must
        # restore the persisted snapshot before the IME service starts.
        d.shell(f'am force-stop {d.PKG}')
        d.shell(f'am start -n {d.PKG}/com.feelime.ime.SetupActivity')
        time.sleep(2)
        assert d.devtools_eval_target('settings', "Native.exportDiagnostics(token); 'ok'") == 'ok'
        time.sleep(0.6)
        names = d.shell(f'run-as {d.PKG} ls cache/exports').split()
        report = d.shell(f'run-as {d.PKG} cat cache/exports/{sorted(n for n in names if n.startswith("feelime-diagnostics-"))[-1]}')
        assert frozen in report, 'cold settings export lost the persisted incident'
        print('PASS process restart: settings export restores the frozen incident', flush=True)
    finally:
        try:
            if active_contacts:
                touch('touchCancel', [])
        finally:
            ws.close()


if __name__ == '__main__':
    main()
