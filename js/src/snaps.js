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
    return Math.sin(Math.PI * a / 180)
}

// return a list of snaps for a given widget
// (probably would be easier if we were using Objects but I DGAF)
function snapsFor(item) {
    function a(deg = 0) { return (item.angle + deg + 360) % 360 }

    switch (item.widget) {
        case STRAIGHT:
            return [
                { x: -item.width / 2, y: 0, angle: a(180) },
                { x: item.width / 2, y: 0, angle: a(0) }
            ]
        case CROSSING:
            return [
                { x: -item.width / 2, y: 0, angle: a(180) }, // horiz left
                { x: item.width / 2, y: 0, angle: a(0) }, // horiz right
                { x: 0 / 2, y: -item.height / 2, angle: a(90) }, // vert top
                { x: 0, y: 0, angle: a(270) } // vert bot
            ]
            break
        case CURVE:
        case LEFT_SWITCH:
        case RIGHT_SWITCH:
            break
        default:
            break
    }
}