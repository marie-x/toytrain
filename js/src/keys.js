// Copyright 2022 max
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

$(document).ready(() => {

    canvasWrapper.addEventListener('keydown', _keyDown, false)
    canvasWrapper.addEventListener('keyup', _keyUp, false)

    const KEY_CODES = {
        8: 'delete',
        9: 'tab',
        16: 'shift',
        17: 'ctrl',
        18: 'alt',
        20: 'caps',
        91: 'cmd',
        32: 'space',
        37: 'left',
        38: 'up',
        39: 'right',
        40: 'down',
        48: '0',
        49: '1',
        50: '2',
        51: '3',
        52: '4',
        53: '5',
        54: '6',
        55: '7',
        56: '8',
        57: '9',
    }

    const ENTER = 'Enter'
    const ESC = 'Escape'

    function metaName(evt) {
        const keys = []
        evt.metaKey && keys.push('Cmd')
        evt.ctrlKey && !keys.includes('Cmd') && keys.push('Cmd')
        evt.altKey && keys.push('Alt')
        evt.shiftKey && keys.push('Shift')
        const s = keys.join('')
        if (s.length) {
            return s[0].toLowerCase() + s.slice(1)
        }
        return ''
    }

    function _keyDown(evt) {

        let key = KEY_CODES[evt.keyCode]
        if (!key) {
            if (evt.keyCode >= 65 && evt.keyCode <= 96) {
                key = String.fromCharCode(evt.keyCode)
            } else {
                key = String(evt.keyCode)
            }
        }
        const meta = metaName(evt)
        // if (meta && key !== meta) {
        //     actionPush('key', meta + '-' + key)
        // } else {
        //     actionPush('key', key)
        // }

        log('keydown:', evt.keyCode)

        const active = activeObject() || activeGroup()
        let type = null
        const shift = evt.shiftKey
        const alt = evt.altKey
        const ctrl = evt.ctrlKey
        const cmd = evt.metaKey

        // FIXME constants
        // FIXME keyCode is deprecated!!
        switch (evt.keyCode) {
            case 8: // delete
            case 46: // backspace
            case 13: // enter
            case 27: // esc
                break
            case 37: // left
                if (!shift && !alt) {
                    _pan(-2 * STEP, 0)
                } else if (active && shift && !alt) {
                    _rotate(active, -1)
                } else if (active && alt) {
                    if (!active.lockMovementX) {
                        _move(active, -STEP, 0)
                    }
                }
                break
            case 39: // right
                if (!shift && !alt) {
                    _pan(2 * STEP, 0)
                } else if (active && shift && !alt) {
                    _rotate(active, 1)
                } else if (active && alt) {
                    if (!active.lockMovementX) {
                        _move(active, STEP, 0)
                    }
                }
                break
            case 38: // up
                if (!shift && !alt) {
                    _pan(0, -2 * STEP)
                } else if (active && shift && !alt) {
                    // cycle through format styles
                    applyToActive(item2 => δ.rotateLayout(item2, 1))
                } else if (active) {
                    if (!active.lockMovementY) {
                        _move(active, 0, -STEP)
                    }
                }
                break
            case 40: // down
                if (!shift && !alt) {
                    _pan(0, 2 * STEP)
                } else if (active && shift && !alt) {
                    // cycle backward through format styles
                    applyToActive(item2 => δ.rotateLayout(item2, -1))
                } else if (active) {
                    if (!active.lockMovementY) {
                        _move(active, 0, STEP)
                    }
                }
                break
            case 49: // 1
            case 50: // 2
            case 51: // 3
            case 52: // 4
            case 53: // 5
            case 54: // 6
            case 65: // A
            case 66: // B
            case 67: // C
            case 88: // X
            case 89: // Y
            case 90: // Z
            case 187: // +
                tryVerb('zoomIn', evt)
                break
            case 189: // -
                tryVerb('zoomOut', evt)
                break
            default:
                // stfu lint
                break
        }

        const keyName = KEY_CODES[evt.keyCode]
        if (keyName) {
            const verb = keyName + 'Down'
            tryVerb(verb, evt, 'silent')
        }
        // priorKeyEvent = evt
    }

    function _keyUp(evt) {
        const keyName = KEY_CODES[evt.keyCode]
        if (keyName) {
            const fn = keyName + 'Up'
            tryVerb(fn, evt, 'silent')
        }
        // priorKeyEvent = evt
    }

    $(document).keydown(evt => {
        // log('document keydown', evt)
        // if a different handler, e.g. _keyDown, handled this,
        // don't re-process it
        if (evt.isDefaultPrevented()) {
            return
        }
        if (evt.target.type === 'text') {
            // if we are on a text input, don't eat keys
            return
        }
        // main body consumed it; redirect to the drafting table handler
        if (evt.target.id === 'draftingTable') {
            _keyDown(evt)
            return
        }
        // FIXME use verb lib
        const keyName = KEY_CODES[evt.keyCode]
        if (keyName) {
            tryVerb(keyName + 'Down', evt, 'silent')
        }
        // _updateButtons('forward', metaName(evt))
        // priorKeyEvent = evt
    })

    $(document).keyup(evt => {
        if (evt.isDefaultPrevented()) {
            return
        }
        // log('document keyup', evt)
        // FIXME use verb lib
        const keyName = KEY_CODES[evt.keyCode]
        if (keyName) {
            tryVerb(keyName + 'Up', evt, 'silent')
        }
        // priorKeyEvent = evt
        // if (!priorKeyEvent.shiftKey && !priorKeyEvent.altKey && !priorKeyEvent.ctrlKey && !priorKeyEvent.metaKey) {
        //     _updateButtons('backward')
        // }
    })
})
