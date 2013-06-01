#!/usr/bin/python

import pygame, random, copy, pickle, math, random
from pygame.sprite import Sprite
from vec2d import vec2d

pygame.init() 

class Environment:
    def __init__(self):
        self.WIDTH=480*3
        self.HEIGHT=320*3
        self.offset = vec2d(0,0) # in pixel-space
        self.scale=0.5
        self.screen_rect = pygame.Rect(0,0,self.WIDTH,self.HEIGHT)
        self.background_color=[69,119,57]
        self.show_snaps = False
        self.screen = pygame.display.set_mode((self.WIDTH,self.HEIGHT))
        self.clock = pygame.time.Clock() # create clock object
        self.pieces = []
        self.selections = []
        self.buttons = []
        self.current_button = None
        self.need_full_redraw = True
        self.mouse_down_pos = (0,0)
        self.mouse_down = False
        self.mainloop = True
        self.ticks = 0
        self.boundaries = pygame.Rect(0,0,10,10)

    def to_screen(self, pt):
        # can't use pure vec math -- pt might be a rect
        return vec2d(self.scale*pt.x + self.offset.x, self.scale*pt.y + self.offset.y)
    
    def to_screen_r(self, rect):
        return pygame.Rect(self.scale*rect.x + self.offset.x, self.scale*rect.y + self.offset.y, rect.width*self.scale, rect.height*self.scale)
    
    def from_screen(self, pt):
        # can't use pure vec math -- pt might be a rect
        return vec2d((pt.x - self.offset.x)/self.scale, (pt.y - self.offset.y)/self.scale)
    
    def from_screen_r(self, rect):
        return pygame.Rect((rect.x - self.offset.x)/self.scale, (rect.y - self.offset.y)/self.scale, rect.width/self.scale, rect.height/self.scale)

    def keep_on_screen(self, car):
        px, py = self.to_screen(car.position)

        # if we walk off the edge of the screen, 
        # move the offset to put us back on
        # (this kind of assumes only one engine per screen)
        if px < self.screen_rect.left:
            self.offset.x += self.WIDTH/2 
        if px > self.screen_rect.right:
            self.offset.x -= self.WIDTH/2 
        if py < self.screen_rect.top:
            self.offset.y += self.HEIGHT/2 
        if py > self.screen_rect.bottom:
            self.offset.y -= self.HEIGHT/2 


env = Environment()

FACTOR = 1
FACTOR2 = 1

def sign_of(x):
    if x < 0:
        return -1
    if x > 0:
        return 1
    return 0

def deg(rad):
    """ for debugging """
    return round(10*rad*180/math.pi)/10.0

def kbd_shift():
    """ is the shift key down? """
    return pygame.key.get_mods() & pygame.KMOD_SHIFT

def kbd_ctrl():
    """ is the ctrl key down? """
    return pygame.key.get_mods() & pygame.KMOD_CTRL

image_store = { }
def load_image(filename):
    print filename
    if not filename in image_store.keys():
        image_store[filename] = pygame.image.load('art/' + filename)
    return image_store[filename]

######################

class Piece(Sprite):
    """ basic piece class, built on sprite """
    
    def __init__(self, filename, position, direction=(1,0)):
        Sprite.__init__(self)
        self.filename = filename
        self.position = vec2d(position)
        self.direction = vec2d(direction).normalized()
        self.prev_direction = vec2d(self.direction)
        self.base_image = load_image(filename)
        self.layer = 0
        self.wheeled = False
        self._render()

    def update(self, passed, pieces):
        """ stub.  passed = time in sec, pieces = all pieces 
            returns a dirty rect """
        return None

    def get_length(self):
        "'length' refers to the width of the artwork"
        return self.base_image.get_size()[0]

    def _render(self):
        """ cache a rotated instance of my base_image """
        global env
        self.image = pygame.transform.rotate(self.base_image, -self.direction.angle) 
        w,h = self.image.get_size()
        self.scaled_image = pygame.transform.smoothscale(self.image, (int(w*env.scale), int(h*env.scale)))
        self._set_rect()
        
    def render(self, env):
        """ render myself on my screen """
        if not self.scaled_image:
            self._render()
            
        env.screen.blit(self.scaled_image, env.to_screen(self.rect))
        
        if env.show_snaps:
            r = int(7*env.scale)
            t = 2
            if t > r:
                t = r
            for snap in self.get_snaps():
                pygame.draw.circle(env.screen, (0,0,0), env.to_screen(snap), r, t)
       
    def get_centerline(self, other):
        """ stub implementation of 'where should other put himself' """
        return vec2d(self.position.x+100, self.position.y+100), -self.direction

    def get_perp(self):
        """ perpendicular unit vector """
        return self.direction.perpendicular()

    def get_snaps(self):
        """ look for snap-to points """
        return []

    def _set_rect(self):
        w, h = self.image.get_size()
        left, top = self.position.x - w/2, self.position.y - h/2
        self.rect = pygame.Rect(left, top, w, h)

    def distance(self, other):
        """ I think there's gotta be a better way than the try """
        try:
            dx = self.position.x - other.position.x
            dy = self.position.y - other.position.y
        except:
            dx = self.position.x - other.x
            dy = self.position.y - other.y
        return math.sqrt(dx*dx + dy*dy)

    def contains(self, point):
        """ this is graphics-specific rather than bbox-specific; 
        it looks at the alpha-channel """
        w, h = self.image.get_size()
        img_point = (int(point.x - (self.position.x - w/2)),
                     int(point.y - (self.position.y - h/2)))
        
        try:
            pix = self.image.get_at(img_point)
            return pix[3] > 0
        except IndexError:
            return False

    def collidepoint(self, rect):
        if self.position.x < rect.left:
            return False
        elif self.position.x > rect.right:
            return False
        elif self.position.y < rect.top:
            return False
        elif self.position.y > rect.bottom:
            return False
        else:
            return True
        
    def center_touches(self, pieces):
        """ center-point-based """
        overlaps = []
        for piece in pieces:
            if self.collidepoint(piece.rect):
                if piece is not self:
                    overlaps.append(piece)
        return overlaps
        
    def bbox_overlaps(self, pieces, inflation=(0,0)):
        """ bounding-box-based """
        overlaps = []
        my_bbox = pygame.Rect(self.rect)
        my_bbox.inflate(inflation)
        for piece in pieces:
            if piece is not self:
                if piece.rect.colliderect(my_bbox):
                    overlaps.append(piece)
        return overlaps
    
    def __getstate__(self):
        """ had to add this so that we can pickle a Sprite """
        odict = self.__dict__.copy() # copy the dict since we change it
        del odict['image']
        del odict['base_image']
        del odict['scaled_image']
        return odict

    def __setstate__(self, dict):
        """ also had to add this to unpickle a Sprite """
        self.wheeled = isinstance(self, Wheeled)
        self.base_image = pygame.image.load('art/' + dict['filename'])
        self.__dict__.update(dict)
        self._render()

    def clone(self):
        return Piece(self.filename, self.position, self.direction)

#############################

class Tunnel(Piece):
    """ something on layer 9 """
    
    def __init__(self, filename, position, direction=(1,0)):
        Piece.__init__(self, filename, position, direction)
        self.layer = 9         

    def clone(self):
        return Tunnel(self.filename, self.position, self.direction)

#############################

# FIXME use sprites for collision detection, NOT my hokey N^2 thing

class Wheeled(Piece):
    """ any mobile piece (e.g. Engine, Car) """

    def __init__(self, filename, position, direction):
        Piece.__init__(self, filename, position, direction)
        self.layer = 1 # wheeled is always one layer up from what it touches
        self.prev_position = vec2d(position)
        self.touched_piece = None
        self.wheeled = True

    def touching(self, pieces):
        """ return a list of all pieces that intersect our center point """
        collisions = []
        for piece in self.center_touches(pieces):
            if piece.contains(self.position):
                collisions.append(piece)
        return collisions

    def constrain_to_screen(self):
        # FIXME use some boundary around the pieces
        # rather than an arbitrary # of screens
        # FIXME perf precompute
        global env
        bounds = env.boundaries.inflate(10, 10)
        # print bounds
        px, py = self.position

        if px < bounds.left:
            self.position.x = bounds.left
            self.direction.x *= -1
            print self, "boinc left"
        if px > bounds.right:
            self.position.x = bounds.right
            self.direction.x *= -1
            print self, "boinc right"
        if py < bounds.top:
            self.position.y = bounds.top
            self.direction.y *= -1
            print self, "boinc top"
        if py > bounds.bottom:
            self.position.y = bounds.bottom
            self.direction.y *= -1
            print self, "boinc bottom"

    def sort_distance(self, piece):
        """ sort functions are int-based """
        dist = piece.distance(self)
        return int(dist)
        
    def update(self, passed, pieces):
        """ make sure that we are properly constrained 
            at any given time """
        
        if self.position == self.prev_position:
            return None
        
        self.constrain_to_screen()
            
        if not self.touched_piece or len(self.touching([self.touched_piece])) == 0:
            collisions = self.touching(pieces)
    
            tracks = [p for p in collisions if p.layer < 5]
    
            if len(tracks) > 0:
                if len(tracks) > 1:
                    tracks.sort(lambda u,v: self.sort_distance(u) - self.sort_distance(v))
                self.touched_piece = tracks[0]
            else:
                self.touched_piece = None
    
        if self.touched_piece:                
            self.position, self.direction = self.touched_piece.get_centerline(self)
            if self.direction != self.prev_direction:
                self.scaled_image = None    # request a redraw
            prev_layer = self.layer
            if self.touched_piece.layer < 9:                
                if (math.fabs(self.layer-3-self.touched_piece.layer) <= 2):
                    self.layer = self.touched_piece.layer + 3
                    if prev_layer != self.layer:
                        print self, prev_layer, "-->", self.layer
                        env.need_full_redraw = True
                        sort_by_layer(env.pieces)
                
        self.prev_position.x = self.position.x
        self.prev_position.y = self.position.y
        self.prev_direction.x = self.direction.x
        self.prev_direction.y = self.direction.y

        dirty = self.rect # old rect

        self._set_rect() # update with new pos & rot
        
        return dirty.union(self.rect) # union with new rect
    
###############################

class Car(Wheeled):
    """ a Car likes to follow whatever is in front of it """
    
    def __init__(self, filename, position, direction=(1,0)):
        Wheeled.__init__(self, filename, position, direction)
        self.following = None
        self.phase = random.random() * math.pi * 2

    def find_closest(self, pieces):
        radius = self.get_length()
        # hunt for someone to follow directly in front of me
        look = self.position + 1.1 * radius*self.direction
        closest = None

        candidates = [p for p in pieces if p.wheeled]
        # print candidates
        if self in candidates: candidates.remove(self)

        # I'm sure I could make this more python-y ...
        for piece in candidates:
            dist = piece.distance(look)
            if dist < radius:
                if closest == None:
                    closest = piece
                else:
                    if closest.distance(self) < dist:
                        closest = piece
        return closest

    def update(self, passed, pieces):
        # put in a sinusoidal target distance

        # look in a cone facing forward
        # move in the direction of the closest Wheeled
        # hopefully we have a piece;
        # let's put ourselves 1.1 lengths from it
        
        #print self, ">", self.following        
        
        if not isinstance(self, Engine):
           
            was_following = self.following
            
            if self.following:
                self.following = self.find_closest([self.following])
                
            if not self.following:
                self.following = self.find_closest(pieces)
                #print "hunted and found", self.following
                
            try:
                if self.following:
                    if self.following.following is self:
                        self.direction.rotate(180)
                        self.following = None
            except:
                pass
                
            if self.following:
                bearing = (self.position - self.following.position).normalized()
                phi = env.ticks/2000.0
                factor = 1.07 + math.sin(phi+self.phase)/20
                self.position = self.following.position + self.get_length() * factor * bearing 
                if not self.following is was_following:
                    self.direction = self.following.direction
        
        return Wheeled.update(self, passed, pieces) # snap to track, etc.

    def clone(self):
        return Car(screen, self.filename, self.position)

###############################

class Engine(Wheeled):
    """ an engine is just go baby go """

    def __init__(self, filename, position, direction, speed):
        Wheeled.__init__(self, filename, position, direction)
        self.speed = speed # scalar
        self.target_speed = speed

    def constrain_to_screen(self):
        global env
        env.keep_on_screen(self)
        Wheeled.constrain_to_screen(self)

    def update(self, passed, pieces):
        # defensive programming
        if math.fabs(self.speed) > 100:
            self.speed = 0
        delta = self.target_speed - self.speed
        if not delta == 0:
            #print "p", passed, "ts", self.target_speed, "sp", self.speed, "delta",delta
            sign = sign_of(delta)
            self.speed += sign * min(passed / 10000.0, math.fabs(delta))
            
        if math.fabs(self.speed) < 0.0001:
            return None
        
        self.position += self.speed * self.direction * passed
        
        return Wheeled.update(self, passed, pieces)

    def clone(self):
        return Engine(self.filename, self.position, self.direction, self.speed)

###############################

class Track(Piece):
    def __init__(self, filename, position, direction):
        Piece.__init__(self, filename, position, direction)
        self._render()

    def get_centerline(self, other):
        "return position, direction"
        
        perp = self.get_perp()
        
        # distance from a point (x0,y0) to a line specified by (x1,y1) and slope (dir.x,dir.y)
        dist = (self.position-other.position).dot(perp)

        dot = self.direction.dot(other.direction)
        if math.fabs(dot) < 0.01:
            proj = other.position
            orient = other.direction            
        elif dot > 0:
            proj = other.position + perp*dist
            orient = self.direction
        else:
            proj = other.position + perp*dist
            orient = -self.direction
            
        return proj, orient 

###############################

class StraightTrack(Track):
    """ simple -- uses base Track code mostly """

    def __init__(self, filename, position, direction=(1,0)):
        Track.__init__(self, filename, position, direction)
        
    def get_snaps(self):
        pos = self.position
        dir = self.direction
        len = self.get_length()
        p1 = pos - dir*(len/2.0)
        p2 = pos + dir*(len/2.02)
        return [p1, p2]

    def clone(self):
        return StraightTrack(self.filename, self.position + self.get_length()*self.direction, self.direction)

############################

class Overpass(StraightTrack):
    def __init__(self, position, direction=(1,0)):
        StraightTrack.__init__(self, "overpass-f.png", (200,200), direction)
        self.layer = 4

    def clone(self):
        return Overpass(self.position + self.get_length()*self.get_perp()/3, self.direction)

############################

class Crossing(StraightTrack):
    def __init__(self, position, direction=(1,0)):
        StraightTrack.__init__(self, "crossing-f.png", position, direction)
        
    def get_centerline(self, other):
        "return position, direction"

        dir = self.direction
        perp = self.get_perp()

        dot_dir = other.direction.dot(dir)
        dot_perp = other.direction.dot(perp)
        
        if math.fabs(dot_dir) < math.fabs(dot_perp):
            perp = self.direction
            dir = self.get_perp()
        
        # distance from a point (x0,y0) to a line specified by (x1,y1) and slope (dir.x,dir.y)
        dist = (self.position-other.position).dot(perp)

        proj = other.position + perp*dist

        if dir.dot(other.direction) > 0:
            orient = dir
        else:
            orient = -dir
            
        return proj, orient

    def get_snaps(self):
        snaps = StraightTrack.get_snaps(self)
        pos = self.position
        dir = self.get_perp()
        len = self.get_length()
        p1 = pos - dir*(len/2.0)
        p2 = pos + dir*(len/2.02)
        snaps.append(p1)
        snaps.append(p2)
        return snaps
    
    def clone(self):
        return Crossing(self.position, self.direction)
    
###############################

class CurvedTrack(Track):
    """ contains curve-following math """

    def __init__(self, filename, position, direction=(1,0), theta=math.pi/4.0):
        Track.__init__(self, filename, position, direction)
        self.theta = theta
        self.mirror = -1
        self.theta = theta
        w, h = self.base_image.get_size()
        s = 1.0 * h / w
        self.frac = 2.0 * (1.0-math.cos(theta) - s*math.sin(theta)) / (s*math.sin(theta) - (1+math.cos(theta)))
        self.radius = self.get_length() / ((self.frac/2.0 + 1) * math.sin(self.theta))
        print "radius",self.radius
    
    def calc_radius(self):
        return 225.0
        #if not 'radius' in self.__dict__.keys():
        #    self.radius = self.get_length() / ((self.frac/2.0 + 1) * math.sin(self.theta))
        #return self.radius
    
    def calc_curve_angles(self, other, proj, orient):
        # calc new orientation
        # first, diff train car from where we are
        diff = proj - self.position
        diff += self.direction * (self.get_length()/2.0)
        # sign of the dot is needed to get the orientation
        # correct when approaching from an oblique angle
        sgn = sign_of(diff.dot(self.direction))
        distance = diff.get_length()   # scalar
        # convert the intercept pt to the curvature angle
        radius = self.calc_radius()
        phi = math.asin(sgn*distance/radius)
        if phi < 0:
            phi = 0    # FIXME figure out how to cap correctly
        if phi > math.pi/4.0:
            phi = math.pi/4.0
        rho = math.atan2(orient.y, orient.x) + phi*self.mirror
        # print "phi",phi,deg(phi),"rho",deg(rho) 
        orient = vec2d(math.cos(rho), math.sin(rho))
        return orient, phi

    def calc_curve_offset(self, proj, phi):
        # calc new projection
        radius = self.calc_radius()
        w,h = self.base_image.get_size()
        factor = radius * (0.5*self.frac + 1 - math.cos(phi)) - h/2.0
        #print "rad",radius,"frac",self.frac,"phi",deg(phi),"theta",deg(self.theta),"factor",factor,"mir",self.mirror
        # print self,"cco", self.mirror
        dx = self.mirror * factor * self.get_perp()
        #print "dx",dx
        proj += dx
        return proj
        # print "orient2",orient

    def get_centerline(self, other):
        proj, orient = Track.get_centerline(self, other)
        
        orient, phi = self.calc_curve_angles(other, proj, orient)
        proj = self.calc_curve_offset(proj, phi)

        return proj, orient

    def get_snaps(self):
        pos = self.position
        dir = self.direction
        frac = self.frac
        rad = self.calc_radius()
        cos = math.cos(self.theta)
        sin = math.sin(self.theta)
        w,h = self.base_image.get_size()
        #print "h",h,"f",frac,"r",rad,".5 f r cos",(0.5*frac*rad*cos),"r(1-cos)",rad*(1.0-cos),"0.5 f r",0.5*frac*rad
        p1 = pos + vec2d(-w/2.0, -self.mirror*(-h/2.0 + 0.5*frac*rad*cos + rad*(1.0-cos))).rotated(dir.get_angle())
        p2 = pos + vec2d(-w/2.0 + rad*sin, -self.mirror*(-h/2.0 + 0.5*frac*rad*cos)).rotated(dir.get_angle())
        return [p1, p2]
    
    def clone(self):
        track = CurvedTrack(self.filename, self.position, self.direction, self.theta)
        track.direction.rotate(45)
        track._render()
        return track

###########################

class Switch(CurvedTrack):
    def __init__(self, filename, position, direction):
        CurvedTrack.__init__(self, filename, position, direction)
        self.switched = False
        self.prior_ticks = 0
        self.touches = 0
        self.mirror = -1

    def maybe_switch(self):
        """ if I haven't been run over lately,
            switch every other new touch """
        delta = env.ticks - self.prior_ticks
        if delta > 1000:
            self.touches += 1
            if (self.touches % 2) == 0:
                print "toggle", self
                self.switched = not self.switched
        self.prior_ticks = env.ticks

    def get_snaps(self):
        curve_snaps = CurvedTrack.get_snaps(self)
        p3 = vec2d(curve_snaps[0])
        p3 += self.direction * (0.925 * self.get_length()) # FIXME figure out constant
        curve_snaps.append(p3)
        return curve_snaps
            
    def get_centerline(self, other):
        self.maybe_switch()

        proj, orient = Track.get_centerline(self, other)
        
        sdot = self.direction.dot(other.direction)        
        forward_switched = self.switched and not (sdot < -0.999)
        rejoining_curved = (-0.5 >= sdot) and (sdot >= -0.999) 
        
        # in these cases, map onto the curve
        if forward_switched or rejoining_curved:            
            # move the virtual position slighly, because the switch curves
            # are rotated relative to the base CurvedTrack
            orient, phi = self.calc_curve_angles(other, proj, orient)
            proj = self.calc_curve_offset(proj, phi)
        else:
            # straight-line case 
            w, h = self.base_image.get_size() 
            r = self.calc_radius()
            ratio = self.mirror * (self.frac*r/2.0 - h/2.0)  # FIXME borked
            #print "w",w,"h",h,"frac",self.frac,"rad",r
            proj += self.get_perp() * ratio  

        return proj, orient

###########################

class SwitchLeft(Switch):
    def __init__(self, position, direction):
        Switch.__init__(self, "switch-left-f.png", position, direction)
        self.mirror = -1 
  
    def get_centerline(self, other):
        self.mirror = -1
        return Switch.get_centerline(self, other)
    
    def clone(self):
        return SwitchLeft(self.position, self.direction)

############################

class SwitchRight(Switch):
    def __init__(self, position, direction):
        Switch.__init__(self, "switch-right-f.png", position, direction)
        self.mirror = 1
    
    def get_centerline(self, other):
        self.mirror = 1
        return Switch.get_centerline(self, other)
    
    def clone(self):
        return SwitchRight(self.position, self.direction)

############################

def sort_by_layer(items):
    print "sort"
    items.sort(lambda x,y: x.layer - y.layer)

def left_mousedown(where):
    global env
    env.mouse_down = True

    # check first for button hits, in screen coords
    for button in env.buttons:
        if button.rect.collidepoint(where):
            print button
            env.current_button = button
            return
        
    where = env.from_screen(vec2d(where))
    env.mouse_down_pos = where    # copy
    s2 = []
    for piece in env.pieces:
        if piece.contains(where):
            s2.append(piece)
    sort_by_layer(s2)
    if len(s2):
        selection = s2[-1]
        print s2, "-->", selection
        env.pieces.remove(selection)
        env.pieces.append(selection)
        sort_by_layer(env.pieces)
    else:
        selection = None

    if kbd_shift():
        if not selection in env.selections:
            if selection is not None:
                env.selections.append(selection)
    elif kbd_ctrl():
        if selection:
            if selection in selections:
                env.selections.remove(selection)
            else:
                env.selections.append(selection)
    else:
        if selection:
            env.selections = [ selection ]
        else:
            env.selections = [ ]

    sort_by_layer(env.selections)
    env.need_full_redraw = True
    print "selections", env.selections

def mousewheel(dir):
    global env
    old_scale = env.scale
    if dir == 1:
        env.scale *= 1.1
    else:
        env.scale /= 1.1
    if math.fabs(env.scale-1.0) < 0.001:
        env.scale = 1.0
    
    r = env.scale/old_scale
    env.offset.x = env.WIDTH/2.0 - r*(env.WIDTH/2.0 - env.offset.x) 
    env.offset.y = env.HEIGHT/2.0 - r*(env.HEIGHT/2.0 - env.offset.y) 
    
    # global pieces
    for piece in env.pieces:
        piece._render()
        
    env.need_full_redraw = True

def mousedown(where, button):
    # print 'v', where
    if button == 1:
        left_mousedown(where)
    elif button == 4:
        mousewheel(1)
    elif button == 5:
        mousewheel(-1)

def maybe_snap(piece):
    global env
    # print "-- maybe_snap", piece,
    overlaps = piece.bbox_overlaps(env.pieces, (7,7))
    my_snaps = piece.get_snaps()
    for other_piece in overlaps:
        their_snaps = other_piece.get_snaps()
        for my_snap in my_snaps:
            for their_snap in their_snaps:
                if my_snap.get_distance(their_snap) < 5:
                    print "snap!"
                    piece.position += their_snap - my_snap
                    return
        
def mousemove(where):
    if env.current_button:
        return
    if env.mouse_down:
        env.need_full_redraw = True
        pygame.mouse.set_cursor(*pygame.cursors.broken_x)
        # print '-', where 
        mouse_move_pos = env.from_screen(vec2d(where))
        change = mouse_move_pos - env.mouse_down_pos
        # print change, env.selections
        if kbd_shift():
            env.offset += change*env.scale
            mouse_move_pos -= change
        else: 
            for selection in env.selections:
                selection.position += change
                maybe_snap(selection)
                selection._set_rect()
        env.mouse_down_pos = vec2d(mouse_move_pos)
    else:
        global FACTOR, FACTOR2
        FACTOR = 0.8 + where[0]/1024.0
        FACTOR2 = 0.8 + where[1]/768.0
        # print "F =", FACTOR

def mouseup(where, button):
    global env
    print '^', where
    env.mouse_down = False
    pygame.mouse.set_cursor(*pygame.cursors.arrow)
    if env.current_button:
        env.current_button.behavior()
        env.current_button = None

def rotate(selections, clockwise):
    for selection in selections:
        env.need_full_redraw = True
        phi = 22.5
        if clockwise:
            phi = -phi
        selection.direction.rotate(phi)
        selection._render()

def add_piece(piece):
    # global pieces
    # I am not sure why I don't
    # need to declare pieces as global
    env.pieces.append(piece)
    sort_layers()
    return piece

def save(pieces):
    pickle.dump(pieces, open("pieces.pickle", 'wb'))
    print 'saved'

def remove(selections):
    for selection in env.selections:
        env.pieces.remove(selection)
        env.need_full_redraw = True
    return []

def duplicate(selections):
    new_selections = []
    for selection in env.selections:
        #try:
        piece = selection.clone()
        if piece.position == selection.position:
            piece.position += piece.get_perp() * piece.get_length()/3.0
        new_selections.append(piece)
        env.pieces.append(piece)
        piece._render()
        #except:
         #   print "clone fail for", selection
    return new_selections

def go():
    for selection in env.selections:
        print "go", selection
        try:
            selection.target_speed += 0.05
        except:
            pass

def pause():
    if kbd_shift():
        for selection in env.pieces:
            try:
                selection.target_speed = 0
            except:
                pass
    else:
        for selection in env.selections:
            print "pause", selection
            try:
                if selection.target_speed > 0.05:
                    selection.target_speed -= 0.05
            except:
                pass

def layermotize(env):            
    for selection in env.selections:
        if kbd_shift():
            selection.layer += 1
        elif selection.layer > 0:
            selection.layer -= 1
        print selection.layer, selection
        
def delete():
    env.selections = remove(env.selections)

def keypress(key):
    """ FIXME use dispatchers """
    global env
    env.need_full_redraw = True  # a bit heavy-handed
    if key == pygame.K_BACKSPACE:
        delete()
    if key == pygame.K_r:
        rotate(env.selections, kbd_shift())
    if key == pygame.K_s:
        save(env.pieces)
    if key == pygame.K_l:
        layermotize(env)
    if key == pygame.K_LEFT:
        env.offset.x += env.WIDTH/4    
    if key == pygame.K_RIGHT:
        env.offset.x -= env.WIDTH/4
    if key == pygame.K_UP:
        env.offset.y += env.HEIGHT/4
    if key == pygame.K_DOWN:
        env.offset.y -= env.HEIGHT/4
    if key == pygame.K_0:
        #add_piece(SwitchLeft((100,100), (1,0)))
        add_piece(Crossing((100,100), (1,0)))
    if key == pygame.K_9:
        add_piece(SwitchRight((200,200), (1,0)))
    if key == pygame.K_8:
        add_piece(Engine("thomas-f.png", (150,150), (1,0), 0.05))
    if key == pygame.K_7:
        add_piece(Piece("tree-f.png", (170,170), (1,0)))
    if key == pygame.K_6:
        add_piece(Tunnel("tunnel1.png", (170,170)))
    if key == pygame.K_5:
        #add_piece(StraightTrack(screen, "straight-f.png", (150, 150)))
        #add_piece(Car("car-red-f.png", (170,170), (1,0)))
        add_piece(Overpass((200,200)))
    if key == pygame.K_4:
        add_piece(CurvedTrack("curve-f.png", (170, 170)))
    if key == pygame.K_3:
        add_piece(StraightTrack("straight-half-f.png", (150, 150)))
    if key == pygame.K_2:
        add_piece(Car("car-blue-f.png", (170,170), (1,0)))
    if key == pygame.K_1:
        add_piece(CurvedTrack("curve2-f.png", (170,170), (1,0), math.pi/8.0))
    if key == pygame.K_d:
        env.selections = duplicate(env.selections)
    if key == pygame.K_p:
        pause()
    if key == pygame.K_k:
        env.show_snaps = not env.show_snaps
    if key == pygame.K_g:
        go()
    if key == pygame.K_ESCAPE or key == pygame.K_q:
        env.mainloop = False
        
    sort_layers()
    
def process_events(events):
    """ simple event dispatch """
    for event in events:
        if event.type == pygame.QUIT:
            env.mainloop = False
        elif event.type == pygame.KEYDOWN:
            keypress(event.key)
        elif event.type == pygame.MOUSEBUTTONDOWN:
            mousedown(event.pos, event.button)
        elif event.type == pygame.MOUSEBUTTONUP:
            mouseup(event.pos, event.button)
        elif event.type == pygame.MOUSEMOTION:
            mousemove(event.pos)

def perform_updates(tick_time):
    """ call update on each piece; return a dirty rect """
    iters = 5
    dirty = None
    dt = tick_time/iters
    wheeled = [p for p in env.pieces if p.wheeled]
    for i in range(iters):
        for piece in wheeled: 
            wee_dirty = piece.update(dt, env.pieces)
            if wee_dirty is not None:
                if dirty is None:
                    dirty = wee_dirty
                else:
                    dirty = dirty.union(wee_dirty)
    
    return dirty.inflate(2,2)

            
def sort_layers():
    #  pieces
    env.pieces.sort(lambda x, y: x.layer - y.layer)

class Button:
    def __init__(self, filename, position, behavior):
        self.position = position
        self.behavior = behavior
        self.image = load_image(filename)
        self.rect = pygame.Rect(position[0], position[1], self.image.get_rect().width, self.image.get_rect().height)
               
    def render(self, env):
        env.screen.blit(self.image, self.rect)

class Puff:
    # FIXME won't re-scale properly if scale changes
    def __init__(self, env, engine):
        TRANSPARENT = (255,0,255)
        w = int(30*env.scale + 1)
        w3 = w/3
        w4 = w/4
        w6 = w/6
        w2 = w/2 - w6
        self.r = w3
        self.velocity = engine.speed * engine.direction
        self.position = vec2d(engine.position) + engine.direction * engine.get_length()/3
        self.direction = vec2d(engine.direction)
        self.image = pygame.Surface((w,w))
        self.image.fill(TRANSPARENT)
        self.image.set_colorkey(TRANSPARENT)
        for i in range(8):
            r1 = random.random() - 0.5
            r2 = random.random() - 0.5
            pygame.draw.circle(self.image, (255,255,255,50), (int(w2+r1*w3),int(w2+r2*w3)), max(1,self.r-5))
        self.created = env.ticks
        
    def render(self, env):
        age = env.ticks - self.created
        pos = self.position # + self.direction * age/10.0
        alpha = 200 - age/10
        if alpha > 0:
            self.image.set_alpha(alpha)
            pt = env.to_screen(pos)
            env.screen.blit(self.image, (pt.x-self.r, pt.y-self.r))

    def update(self, passed):
        self.position += self.velocity
        self.velocity *= (1 - passed/10000.0)        
        puffrect = pygame.Rect(self.position.x-6*self.r, self.position.y-6*self.r, 12*self.r, 12*self.r)
        return puffrect

            
def make_buttons():
    # FIXME add context-sensitivity
    global env
    left = env.WIDTH - 48    
    i = 0
    
    rotleft = Button("rot-left-icon.png", (left, i*48), lambda: rotate(env.selections, True))                     
    env.buttons.append(rotleft)
    i += 1
    
    rotright = Button("rot-right-icon.png", (left, i*48), lambda: rotate(env.selections, False))                     
    env.buttons.append(rotright)
    i += 1
    
    zoomin = Button("zoom-in-icon.png", (left, i*48), lambda: mousewheel(1))                     
    env.buttons.append(zoomin)
    i += 1

    zoomout = Button("zoom-out-icon.png", (left, i*48), lambda: mousewheel(-1))                     
    env.buttons.append(zoomout)
    i += 1
    
    gobutt = Button("go-icon.png", (left, i*48), lambda: go())
    env.buttons.append(gobutt)
    i += 1
    
    stopbutt = Button("stop-icon.png", (left, i*48), lambda: pause())
    env.buttons.append(stopbutt)
    i += 1

    trash = Button("trash-icon.png", (left, i*48), lambda: delete())
    env.buttons.append(trash)
    i += 1


def main():
    print "choo choo!"

    env.boundaries = pygame.Rect(0,0,10,10)

    env.pieces = pickle.load(open("pieces.pickle", 'rb'))
    print "loaded", len(env.pieces), "pieces"
    
    for piece in env.pieces:
        piece._render()
        env.boundaries = env.boundaries.union(piece.rect)
        if piece.wheeled:
            print piece

    env.boundaries = env.boundaries.inflate(50, 50)
    
    sort_layers()

    make_buttons()
    
    puffs = []
    last_puff = 0
    
    # FIXME support more than one engine
    for piece in env.pieces:
        if isinstance(piece, Engine):
            engine = piece
            
    # while mainloop:
    total_frames = 0
    while env.mainloop:

        total_frames += 1
        if profile:
            if total_frames >= 999:
                env.mainloop = False
                
        fps = 30
        tick_time = env.clock.tick(fps) # returns milliseconds since last frame
        env.ticks = pygame.time.get_ticks()
        
        if total_frames % 45 == 0:
            pygame.display.set_caption("press Esc to quit. FPS: %.2f" % (env.clock.get_fps()))
        
        offset_old = vec2d(env.offset)
        scale_old = env.scale
        
        process_events(pygame.event.get())
        
        dirty = perform_updates(tick_time)
        
        if (offset_old != env.offset) or (scale_old != env.scale):
            print "full"
            env.need_full_redraw = True
            
        if env.need_full_redraw or dirty == None:
            dirty_screen = env.screen_rect
            dirty = env.from_screen_r(dirty_screen)
        else: 
            for puff in puffs:
                dirty = dirty.union(puff.update(tick_time))
            dirty_screen = env.to_screen_r(dirty)
        
        # print "dirty_screen", dirty_screen
        
        env.screen.fill(env.background_color, dirty_screen)
            
        for piece in env.pieces:
            if dirty.colliderect(piece.rect):
                piece.render(env)

        # FIXME faster should mean more puffs
        if engine.speed > 0:
            if env.ticks - last_puff > 100:
                puffs.insert(0, Puff(env, engine))
                last_puff = env.ticks            
                
        for puff in puffs:
            puff.render(env)
        
        if len(puffs) > 20:
            puffs.remove(puffs[-1])
            
        for button in env.buttons:
            if dirty_screen.colliderect(button.rect):
                button.render(env)
                
        #pygame.draw.rect(env.screen, (0,0,0), dirty_screen, 1)
        
        pygame.display.update(dirty_screen)
        env.need_full_redraw = False

    print total_frames, "frames"
    save(env.pieces)
    
import sys
profile = '--profile' in sys.argv

if profile:
    import cProfile as profile
    profile.run('main()')
else:
    main()    

    
        # fontsize = random.randint(35, 150)
        # myFont = pygame.font.SysFont("None", fontsize)
        # color = (random.randint(0,255), random.randint(0,255), random.randint(0,255))
        # screen.blit(myFont.render("I love the pygame cookbook", 0, (color)), (x,y))
        # print 'frame ----'

    
    
"""
To do:
* highlight selections
* correct multiple selection
Y switch
tool palette
buttons
better load & store
grabby hand icons
different radius curves
"""
