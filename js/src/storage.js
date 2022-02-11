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

// TODO undo/redo
// TODO database

const EXTRAS = ['widget', 'layer', 'sublayer', 'id', 'originX', 'originY', 'trail', 'velocity', 'switched']

function save() {
    log('save')
    localStorage.setItem('train', JSON.stringify(canvas.toJSON(EXTRAS)))
}

function rehydrate(item) {
    item.setControlsVisibility(CTRLS_WIDGET)
}

async function load() {
    return new Promise((resolve, reject) => {
        const json = localStorage.getItem('train')
        if (json) {
            canvas.loadFromJSON(json, () => {
                canvas.getObjects().forEach(rehydrate)
                resolve()
            })
        } else {
            resolve() // is okay
        }
    })
}

let pasteBuffer, pasteGroup

// FIXME work to be done
async function keyCopy(evt) {
    pasteBuffer = {}
    pasteGroup = []
    // dupOne's double-callback prevents me from removing this Promise declaration, I think
    return new Promise((resolve, reject) => {
        const active = activeObject()
        if (active) {
            pasteCenter = globalCenter(active)
            // TODO copy the dupOne code
            dupOne(active, {
                doNotAdd: true,
            }, copy => {
                pasteGroup = [copy.id]
                pasteBuffer[copy.id] = copy
                resolve(pasteBuffer)
            }, kidCopy => {
                pasteBuffer[kidCopy.id] = kidCopy
            })
        } else {
            const group = activeGroup()
            if (group) {
                pasteCenter = globalCenter(group)
                const items = group.getObjects().slice()
                discardActiveObject()
                for (const item of items) {
                    dupOne(item, {
                        doNotAdd: true,
                    }, copy => {
                        pasteBuffer[copy.id] = copy
                        pasteGroup.push(copy.id)
                        if (pasteGroup.length === items.length) {
                            createSelection(items)
                            resolve(pasteBuffer)
                        }
                    }, kidCopy => {
                        pasteBuffer[kidCopy.id] = kidCopy
                    })
                }
            }
        }
    })
}

// FIXME work to be done
function keyCut(evt) {
    if (activeObject() || activeGroup()) {
        keyCopy(evt).then(() => {
            applyToActive(_removeOne)
            discardActiveObject()
            renderAll('cut')
        })
    }
}

// FIXME work to be done
function keyPaste(evt, shift) {
    const items = Object.values(pasteBuffer)
    if (items.length === 0) {
        return
    }

    let dx = 0, dy = 0
    // shift means "use whatever left/top the object(s) originally had"
    // rather than "at cursor"
    if (!shift) {
        const { left, top } = atCrosshair(evt)
        dx = left - pasteCenter.x
        dy = top - pasteCenter.y
        if (isNaN(dx) || isNaN(dy)) {
            return
        }
    }
    items.map(item => {
        item.left += dx
        item.top += dy
        // TODO would we ever paste an item without a plate??
        addToCanvas(item)
    })

    if (pasteGroup.length > 1) {
        createSelection(pasteGroup.map(id => findById(id)))
    } else {
        setActiveObject(pasteGroup[0])
    }
    keyCopy(evt)
}
