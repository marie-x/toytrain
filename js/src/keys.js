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

    canvasWrapper.addEventListener('keydown', keyDown, false)
    canvasWrapper.addEventListener('keyup', keyUp, false)

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

    function keyDown(evt) {

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
        if (cmd && evt.keyCode === 82) {
            return // let's not on reload
        }

        // FIXME constants
        // FIXME keyCode is deprecated!!
        switch (evt.keyCode) {
            case 8: // delete
            case 46: // backspace
                evt.preventDefault()
                tryVerb('remove', evt)
                break
            case 13: // enter
            case 27: // esc
                break
            case 37: // left
                if (!shift && !alt) {
                    if (active) {
                        move(active, -STEP, 0)
                    }
                    else {
                        pan(-2 * STEP, 0)
                    }
                } else if (active && shift && !alt) {
                    rotate(active, -1)
                }
                break
            case 39: // right
                if (!shift && !alt) {
                    if (active) {
                        move(active, STEP, 0)
                    }
                    else {
                        pan(2 * STEP, 0)
                    }
                } else if (active && shift && !alt) {
                    rotate(active, 1)
                }
                break
            case 38: // up
                if (!shift && !alt) {
                    if (active) {
                        move(active, 0, -STEP)
                    }
                    else {
                        pan(0, -2 * STEP)
                    }
                }
                break
            case 40: // down
                if (!shift && !alt) {
                    pan(0, 2 * STEP)
                } else if (active) {
                    if (!active.lockMovementY) {
                        move(active, 0, STEP)
                    }
                }
                break
            case 48: // 0
                setVelocity(0)
                break
            case 49: // 1
                setVelocity(0.5)
                break
            case 50: // 2
                setVelocity(1.0)
                break
            case 51: // 3
                setVelocity(1.5)
                break
            case 52: // 4
                setVelocity(2.0)
                break
            case 53: // 5
                setVelocity(2.5)
                break
            case 54: // 6
                setVelocity(3.0)
                break
            case 65: // A
                tryVerb('addCaboose', evt)
                break
            case 66: // B
                tryVerb('addBoxcar', evt)
                break
            case 67: // C
                if (cmd) {
                    evt.preventDefault()
                    keyCopy(evt)
                } else {
                    tryVerb('addCurve', evt)
                }
                break
            case 68: // D
                tryVerb('duplicate', evt)
                break
            case 69: // E
                tryVerb('addEngine', evt)
                break
            case 70: // F
                tryVerb('addBoxcar2', evt)
                break
            case 71: // G
                tryVerb('addEndpoint', evt)
                break
            case 72: // H
                tryVerb('addCurve2', evt)
                break
            case 73: // I
                break
            case 74: // J
                break
            case 75: // K
                tryVerb('addStraight2', evt)
                break
            case 76: // L
                tryVerb('addLeft', evt)
                break
            case 80: // P
                break
            case 81: // Q
                break
            case 82: // R
                tryVerb('addRight', evt)
                break
            case 83: // S
                if (cmd) {
                    evt.preventDefault()
                    download('train-snapshot.json', save())
                } else {
                    tryVerb('addStraight', evt)
                }
                break
            case 84: // T
                tryVerb('addTree', evt)
                break
            case 85: // U
                // read default file
                readDemo()
                break
            case 86: // V
                if (cmd) {
                    keyPaste(evt)
                }
                break
            case 87: // W
                if (active) {
                    if (active.widget === SWITCH_LEFT || active.widget === SWITCH_RIGHT) {
                        active.switched = !active.switched
                    }
                }
                break
            case 88: // X
                if (cmd) {
                    evt.preventDefault()
                    keyCut(evt)
                } else {
                    tryVerb('addCrossing', evt)
                }
                break
            case 89: // Y
            case 90: // Z
                break
            case 91: // cmd/meta
                metaDown(evt)
                break
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

    function keyUp(evt) {
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
            keyDown(evt)
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
