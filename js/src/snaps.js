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

function sin(a) {
    return Math.sin(Math.PI * a / 180)
}

function cos(a) {
    return Math.cos(Math.PI * a / 180)
}

function dist(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
        return Math.sqrt(a * a + b * b)
    }
    if (typeof a.x === 'number' && typeof b.y === 'number') {
        return dist(a.x - b.x, a.y - b.y)
    }
    if (typeof a.left === 'number' && typeof b.top === 'number') {
        return dist(a.left - b.left, a.top - b.top)
    }
    throw Error('dist junk')
}

function snapsMatch(snap, snap2) {
    // test angles to see if they are 180º from each other
    return Math.abs((snap.angle - snap2.angle + 180 + 360) % 360) < 5
}

function onMovingSnap(evt) {
    // remove all circles
    eachObject(item => {
        if (item.type === 'circle') {
            canvas.remove(item)
        }
    })

    const { target: item } = evt
    const snaps = snapsFor(item)
    snaps.forEach(snap => {
        const dot = new fabric.Circle({
            radius: 5,
            fill: 'blue',
            left: snap.x,
            top: snap.y,
            originX: 'center',
            originY: 'center',
        })
        canvas.add(dot)
    })
    let minSnap = null, minSnap2 = null, minSnapDist = 20 // don't snap past a certain distance
    eachObject(item2 => {
        if (item.id !== item2.id) {
            const snaps2 = snapsFor(item2)
            snaps.forEach(snap => {
                snaps2.forEach(snap2 => {
                    // const dot = new fabric.Circle({
                    //     radius: 5,
                    //     fill: 'red',
                    //     left: snap2.x,
                    //     top: snap2.y,
                    //     originX: 'center',
                    //     originY: 'center',
                    // })
                    // canvas.add(dot)
                    // log('me:', snap.angle, 'you:', snap2.angle)
                    if (snapsMatch(snap, snap2)) {
                        const d = dist(snap, snap2)
                        // log('d:', d)
                        if (d < minSnapDist) {
                            minSnap = snap
                            minSnap2 = snap2
                            minSnapDist = d
                        }
                    }
                })
            })
        }
    })
    if (minSnap) {
        // snap
        item.left += minSnap2.x - minSnap.x
        item.top += minSnap2.y - minSnap.y
    }
}

$(document).ready(() => {
    canvas.on({
        'object:moving': onMovingSnap,
    })
})

// return a list of snaps for a given widget
// (probably would be easier if we were using Objects but I DGAF)
function snapsFor(item) {
    const { angle, widget, width, height, left, top } = item
    const W = 45 // track width
    const bx = W / 2 * sin(45)
    const by = W / 2 * cos(45)

    function rawSnaps() {
        switch (widget) {
            case STRAIGHT:
                return [
                    { x: -width / 2, y: 0 },
                    { x: width / 2, y: 0 }
                ]
            case CROSSING:
                return [
                    { x: -width / 2, y: 0 }, // horiz left
                    { x: width / 2, y: 0 }, // horiz right
                    { x: 0, y: -height / 2 }, // vert top
                    { x: 0, y: height / 2 } // vert bot
                ]
                break
            case CURVE:
                return [
                    { x: -width / 2, y: height / 2 - W / 2, angle: 180 },
                    { x: width / 2 - bx, y: -height / 2 + by, angle: -45 }
                ]
            case SWITCH_LEFT:
                return [
                    { x: -width / 2, y: height / 2 - W / 2, angle: 180 },
                    { x: width / 2 - bx, y: height / 2 - W / 2, angle: 0 },
                    { x: width / 2 - bx, y: -height / 2 + by, angle: -45 }
                ]
            case SWITCH_RIGHT:
                return [
                    { x: -width / 2, y: -height / 2 + W / 2, angle: 180 },
                    { x: width / 2 - bx, y: -height / 2 + W / 2, angle: 0 },
                    { x: width / 2 - bx, y: height / 2 - by, angle: 45 }
                ]
                break
            default:
                break
        }
        return []
    }
    return rawSnaps().map(raw => {
        return {
            x: left + cos(angle) * raw.x - sin(angle) * raw.y,
            y: top + sin(angle) * raw.x + cos(angle) * raw.y,
            angle: angle + (raw.angle === undefined ? 180 * Math.atan2(raw.y, raw.x) / Math.PI : raw.angle)
        }
    })
}