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
    if (typeof a.left === 'number' && typeof b.y === 'number') {
        return dist(a.left - b.x, a.top - b.y)
    }
    throw Error('dist junk')
}

function snapsMatch(snap, snap2) {
    // test angles to see if they are 180º from each other
    return Math.abs((snap.angle - snap2.angle + 180 + 360) % 360) < 5
}

function snapItem(item, minSnapDist = 20) {
    // log('snap', item, minSnapDist)
    const snaps = snapsFor(item)
    snaps.forEach(snap => {
        makeDot({ fill: 'brown', left: snap.x, top: snap.y })
    })
    let minSnap = null, minSnap2 = null // don't snap past a certain distance
    eachObject(item2 => {
        if (item.id !== item2.id) {
            const snaps2 = snapsFor(item2)
            snaps.forEach(snap => {
                snaps2.forEach(snap2 => {
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

function onMovingSnap(evt) {
    // remove all circles
    eachObject(item => {
        if (item.type === 'circle') {
            canvas.remove(item)
        }
    })

    const { target: item } = evt
    snapItem(item)
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
    const bx2 = W / 2 * sin(45 / 2)
    const by2 = W / 2 * cos(45 / 2)

    function rawSnaps() {
        switch (widget) {
            case ENDPOINT:
                return [
                    { x: -width / 2, y: 0 }
                ]
            case STRAIGHT:
            case STRAIGHT2:
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
            case CURVE2:
                return [
                    { x: -width / 2, y: height / 2 - W / 2, angle: 180 },
                    { x: width / 2 - bx2, y: -height / 2 + by2, angle: -45 / 2 }
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
            angle: angle + (raw.angle === undefined ? 180 * Math.atan2(raw.y, raw.x) / Math.PI : raw.angle),
        }
    })
}

function segmentsFor(item) {
    const { angle, widget, width, height, left, top } = item
    const W = 45 // track width
    const bx = W / 2 * sin(45)
    const by = W / 2 * cos(45)
    const x1s = item.switched ? -width / 3 : -width / 2 // switches only

    function rawSegments() {
        switch (widget) {
            case STRAIGHT:
            case STRAIGHT2:
                return [{ x1: -width / 2, y1: 0, x2: width / 2, y2: 0 }]
            case CROSSING:
                return [
                    { x1: -width / 2, y1: 0, x2: width / 2, y2: 0 }, // horiz 
                    { x1: 0, y1: -height / 2, x2: 0, y2: height / 2 } // vert 
                ]
                break
            case SWITCH_LEFT:
                return [{
                    x1: x1s, y1: height / 2 - W / 2,
                    x2: width / 2 - bx, y2: height / 2 - W / 2
                }]
            case SWITCH_RIGHT:
                return [{
                    x1: x1s, y1: -height / 2 + W / 2,
                    x2: width / 2 - bx, y2: -height / 2 + W / 2
                }]
            default:
                return []
        }
    }
    return rawSegments().map(raw => {
        return {
            x1: left + cos(angle) * raw.x1 - sin(angle) * raw.y1,
            y1: top + sin(angle) * raw.x1 + cos(angle) * raw.y1,
            x2: left + cos(angle) * raw.x2 - sin(angle) * raw.y2,
            y2: top + sin(angle) * raw.x2 + cos(angle) * raw.y2,
        }
    })

}

// calc centroids and angle ranges
function arcsFor(item) {
    const { angle, widget, width, left, top, switched } = item

    const radius = 194    // weird geometry constant FIXME
    function rawArcs() {
        switch (widget) {
            case CURVE:
                return [{ x: -width / 2, y: -radius, start: 45, end: 90 }]
            case CURVE2:
                return [{ x: -width / 2, y: -radius - 22, start: 45 * 1.5, end: 90 }]
            case SWITCH_LEFT:
                return [{ x: -width / 2, y: -radius, start: 45, end: switched ? 90 : 85 }]
            case SWITCH_RIGHT:
                return [{ x: -width / 2, y: radius, start: switched ? 270 : 275, end: 315 }]
            default:
                return []
        }
    }
    return rawArcs().map(raw => {
        return {
            x: left + cos(angle) * raw.x - sin(angle) * raw.y,
            y: top + sin(angle) * raw.x + cos(angle) * raw.y,
            start: wrap(angle + raw.start),
            end: wrap(angle + raw.end),
            radius: radius + 30 // TODO FIXME
        }
    })

}

// project point p1 onto the segment represented by points s1 and s2
function projectOnSeg(pt, seg, extend) {
    const { left: x, top: y } = pt
    const A = x - seg.x1
    const B = y - seg.y1
    const C = seg.x2 - seg.x1
    const D = seg.y2 - seg.y1

    const dot = A * C + B * D
    const len_squared = C * C + D * D
    let u = -1
    if (len_squared > 0) {
        // in case of 0 length line
        u = dot / len_squared
    }

    if (u < 0 && !extend) {
        return {
            x: seg.x1,
            y: seg.y1,
            u
        }
    } else if (u > 1 && !extend) {
        return {
            x: seg.x2,
            y: seg.y2,
            u
        }
    }
    return {
        x: seg.x1 + u * C,
        y: seg.y1 + u * D,
        u
    }
}

function eachTrack(fn) {
    allObjects(item =>
        item.widget === STRAIGHT ||
        item.widget === STRAIGHT2 ||
        item.widget === CURVE ||
        item.widget === CURVE2 ||
        item.widget === ENDPOINT ||
        item.widget === SWITCH_LEFT ||
        item.widget === SWITCH_RIGHT ||
        item.widget === CROSSING
    ).forEach(fn)
}

function eachSwitch(fn) {
    allObjects(item =>
        item.widget === SWITCH_LEFT ||
        item.widget === SWITCH_RIGHT
    ).forEach(fn)
}

function eachEngine(fn) {
    allObjects(item =>
        item.widget === ENGINE
    ).forEach(fn)
}

function eachCar(fn) {
    allObjects(item =>
        item.widget === BOXCAR ||
        item.widget === BOXCAR2 ||
        item.widget === CABOOSE
    ).forEach(fn)
}

function wrap(phi) {
    return (phi + 360) % 360
}

function angleDiff(a, b) {
    const c = Math.abs(((a - b + 180) % 360) - 180)
    const d = Math.min(c, 360 - c)
    return d
}

const MIN_INCIDENT = 35

function getTrackSnap(car, debug) {
    let minPt = null, minAngle = null, minDist = 35 // don't snap past a certain distance
    eachTrack(track => {
        segmentsFor(track).forEach(seg => {
            const segAngle = 180 * Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1) / Math.PI
            const segAngle2 = 180 + segAngle
            const fwd = angleDiff(car.angle, segAngle) < MIN_INCIDENT
            const rev = angleDiff(car.angle, segAngle2) < MIN_INCIDENT
            debug && log('track:' + track.id, 'car:' + car.angle, 'fwd:' + segAngle, fwd, 'rev:' + segAngle2, rev)
            if (fwd || rev) {
                const projection = projectOnSeg(car, seg)
                const d = dist(car, projection)
                debug && log('d:', d)
                if (d < minDist) {
                    minPt = projection
                    minAngle = fwd ? segAngle : segAngle2
                    minDist = d
                }
            }
        })

        arcsFor(track).forEach(arc => {
            // see how far we are from the point
            const dc = dist(car, arc)
            const d = Math.abs(dc - arc.radius)
            const dd = false // d < 100
            const angleC = wrap(180 + 180 * Math.atan2(arc.y - car.top, arc.x - car.left) / Math.PI)
            const arcAngle = wrap(angleC + 90)
            const arcAngle2 = wrap(angleC - 90)
            if (angleC > arc.start && angleC < (arc.end || 360)) {
                const fwd = angleDiff(car.angle, arcAngle) < MIN_INCIDENT
                const rev = angleDiff(car.angle, arcAngle2) < MIN_INCIDENT
                if (fwd || rev) {
                    if (d < minDist) {
                        minDist = d
                        minAngle = fwd ? arcAngle : arcAngle2
                        minPt = {
                            x: arc.x + arc.radius * cos(angleC),
                            y: arc.y + arc.radius * sin(angleC),
                            u: 0.5 // FIXME calc proper U
                        }
                    }
                }
            }
        })
    })
    return { minAngle, minPt }
}

