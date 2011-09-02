/**
 * Game class library, utility functions and globals.
 * 
 * @author Kevin Roast
 * 
 * 30/04/09 Initial version.
 * 12/05/09 Refactored to remove globals into GameHandler instance and added FPS controller game loop.
 * 17/01/11 Full screen resizable canvas
 * 26/01/11 World to screen transformation - no longer unit=pixel
 */

var KEY = { SHIFT:16, CTRL:17, ESC:27, RIGHT:39, UP:38, LEFT:37, DOWN:40, SPACE:32,
            A:65, D:68, E:69, G:71, L:76, P:80, R:82, S:83, W:87, Z:90, OPENBRACKET:219, CLOSEBRACKET:221 };

/**
 * Game Handler.
 * 
 * Singleton instance responsible for managing the main game loop and
 * maintaining a few global references such as the canvas and frame counters.
 */
var GameHandler =
{
   /**
    * The single Game.Main derived instance
    */
   game: null,
   
   /**
    * True if the game is in pause state, false if running
    */
   paused: false,
   
   /**
    * The single canvas play field element reference
    */
   canvas: null,
   
   /**
    * Width of the canvas play field
    */
   width: 0,
   
   /**
    * Height of the canvas play field
    */
   height: 0,
   
   offsetX: 0,
   
   offsetY: 0,
   
   /**
    * Frame counter
    */
   frameCount: 0,
   
   /**
    * Debugging output
    */
   maxfps: 0,
   frametime: 0,
   
   /**
    * Init function called once by a window.onload handler
    */
   init: function(minimumSize, padding)
   {
      var canvas = document.getElementById('canvas');
      if (!minimumSize)
      {
         canvas.width = this.width;
         canvas.height = this.height;
      }
      this.canvas = canvas;
      this.minimumSize = minimumSize;
      this.padding = padding;
      
      window.addEventListener('resize', this.resizeHandler, false);
      window.addEventListener('scroll', this.resizeHandler, false);
      
      // calculate the initial canvas offsets by manually calling the resize handler
      this.resizeHandler();
   },
   
   /**
    * Handler to compute canvas size based on current window size and offset
    */
   resizeHandler: function()
   {
      var me = GameHandler;
      var el = me.canvas, x = 0, y = 0; 
      do
      {
         y += el.offsetTop;
         x += el.offsetLeft;
      } while (el = el.offsetParent);
      
      // compute offset including page view position
      me.offsetX = x - window.pageXOffset;
      me.offsetY = y - window.pageYOffset;
      
      // canvas size may be controlled by window height if minimum size set
      if (me.minimumSize)
      {
         var size = window.innerHeight > me.minimumSize + me.padding ? window.innerHeight - me.padding : me.minimumSize;
         if (me.width !== size)
         {
            //if (DEBUG) console.log("Updating canvas size: " + size + " offsets: " + x + "," + y);
            me.width = me.height = me.canvas.width = me.canvas.height = size;
         }
      }
      //if (DEBUG) console.log("Canvas offset: " + x + "," + y);
   },
   
   /**
    * Game start method - begins the main game loop.
    * Pass in the object that represent the game to execute.
    * Also called each frame by the main game loop unless paused.
    * 
    * @param {Game.Main} game main derived object handler
    */
   start: function(game)
   {
      if (game) this.game = game;
      GameHandler.game.frame();
   },
   
   /**
    * Game pause toggle method.
    */
   pause: function()
   {
      if (this.paused)
      {
         this.paused = false;
         GameHandler.game.frame();
      }
      else
      {
         this.paused = true;
      }
   }
};


/**
 * Game root namespace.
 *
 * @namespace Game
 */
if (typeof Game == "undefined" || !Game)
{
   var Game = {};
}


/**
 * Transform a vector from world coordinates to screen
 * 
 * @method worldToScreen
 * @return Vector or null if non visible
 */
Game.worldToScreen = function worldToScreen(vector, world, radiusx, radiusy)
{
   // transform a vector from the world to the screen
   radiusx = (radiusx ? radiusx : 0);
   radiusy = (radiusy ? radiusy : radiusx);
   var screenvec = null,
       viewx = vector.x - world.viewx,
       viewy = vector.y - world.viewy;
   if (viewx < world.viewsize + radiusx && viewy < world.viewsize + radiusy &&
       viewx > -radiusx && viewy > -radiusy)
   {
      screenvec = new Vector(viewx, viewy).scale(world.scale);
   }
   return screenvec;
};


/**
 * Game main loop class.
 * 
 * @namespace Game
 * @class Game.Main
 */
(function()
{
   Game.Main = function()
   {
      var me = this;
      
      document.onkeydown = function(event)
      {
         var keyCode = (event === null ? window.event.keyCode : event.keyCode);
         
         if (me.sceneIndex !== -1)
         {
            if (me.scenes[me.sceneIndex].onKeyDownHandler(keyCode))
            {
               // if the key is handled, prevent any further events
               if (event)
               {
                  event.preventDefault();
                  event.stopPropagation();
               }
            }
         }
      };
      
      document.onkeyup = function(event)
      {
         var keyCode = (event === null ? window.event.keyCode : event.keyCode);
         
         if (me.sceneIndex !== -1)
         {
            if (me.scenes[me.sceneIndex].onKeyUpHandler(keyCode))
            {
               // if the key is handled, prevent any further events
               if (event)
               {
                  event.preventDefault();
                  event.stopPropagation();
               }
            }
         }
      };
   };
   
   Game.Main.prototype =
   {
      scenes: [],
      
      startScene: null,
      
      endScene: null,
      
      currentScene: null,
      
      sceneIndex: -1,
      
      fps: 33,
      
      lastFrameStart: 0,
      
      interval: null,
      
      /**
       * Game frame execute method - called by window timeout/interval
       */
      frame: function frame()
      {
         var frameStart = Date.now();
         
         GameHandler.resizeHandler();
         
         // calculate scene transition and current scene
         var currentScene = this.currentScene;
         if (currentScene === null)
         {
            //alert("game init - scene at 0");
            // set to scene zero (game init)
            this.sceneIndex = 0;
            currentScene = this.scenes[0];
            currentScene.onInitScene();
         }
         else if (this.isGameOver())
         {
            //alert("game over! - scene at endScene");
            this.sceneIndex = -1;
            currentScene = this.endScene;
            currentScene.onInitScene();
         }
         
         if ((currentScene.interval === null || currentScene.interval.complete) && currentScene.isComplete())
         {
            //alert("scene interval complete and scene completed.");
            this.sceneIndex++;
            if (this.sceneIndex < this.scenes.length)
            {
               currentScene = this.scenes[this.sceneIndex];
            }
            else
            {
               this.sceneIndex = 0;
               currentScene = this.scenes[0];
            }
            //alert("sceneIndex: " + this.sceneIndex);
            currentScene.onInitScene();
         }
         
         // get canvas context for a render pass
         var ctx = GameHandler.canvas.getContext('2d');
         
         // calculate viewport transform and offset against the world
         // we want to show a fixed number of world units in our viewport
         // so calculate the scaling factor to transform world to view
         currentScene.world.scale = GameHandler.width / currentScene.world.viewsize;
         
         // render the game and current scene;
         if (currentScene.interval === null || currentScene.interval.complete)
         {
            currentScene.onBeforeRenderScene();
            currentScene.onRenderScene(ctx);
         }
         else
         {
            this.onRenderGame(ctx);
            currentScene.interval.intervalRenderer.call(currentScene, currentScene.interval, ctx);
         }
         
         // update global frame counter and current scene reference
         this.currentScene = currentScene;
         GameHandler.frameCount++;
         
         // calculate FPS interval required for smooth animation
         var frameOffset = Math.floor(1000 / this.fps) - (Date.now() - frameStart);
         if (DEBUG)
         {
            GameHandler.maxfps = Math.round(1000 / (frameStart - this.lastFrameStart));
            GameHandler.frametime = Date.now() - frameStart;
         }
         this.lastFrameStart = frameStart;
         if (!GameHandler.paused) setTimeout(GameHandler.start, frameOffset <= 0 ? 1 : frameOffset);
      },
      
      onRenderGame: function onRenderGame(ctx)
      {
      },
      
      isGameOver: function isGameOver()
      {
         return false;
      }
   };
})();


/**
 * Game scene base class.
 * 
 * @namespace Game
 * @class Game.Scene
 */
(function()
{
   Game.Scene = function(playable, interval)
   {
      this.playable = playable;
      this.interval = interval;
   };
   
   Game.Scene.prototype =
   {
      playable: true,
      
      interval: null,
      
      world:
      {
         size: 1500,       // total units vertically and horizontally
         viewx: 0,         // current view left corner xpos
         viewy: 0,         // current view left corner ypos
         viewsize: 1000,   // size of the viewable area
         scale: 1000/1500  // scale for world->view transformation - calculated based on physical viewport size
      },
      
      /**
       * Return true if this scene should update the actor list.
       */
      isPlayable: function isPlayable()
      {
         return this.playable;
      },
      
      onInitScene: function onInitScene()
      {
         if (this.interval !== null)
         {
            // reset interval flag
            this.interval.reset();
         }
      },
      
      onBeforeRenderScene: function onBeforeRenderScene()
      {
      },
      
      onRenderScene: function onRenderScene(ctx)
      {
      },
      
      onRenderInterval: function onRenderInterval(ctx)
      {
      },
      
      onKeyDownHandler: function onKeyDownHandler(keyCode)
      {
      },
      
      onKeyUpHandler: function onKeyUpHandler(keyCode)
      {
      },
      
      isComplete: function isComplete()
      {
         return false;
      }
   };
})();


(function()
{
   Game.Interval = function(label, intervalRenderer)
   {
      this.label = label;
      this.intervalRenderer = intervalRenderer;
      this.framecounter = 0;
      this.complete = false;
   };
   
   Game.Interval.prototype =
   {
      label: null,
      intervalRenderer: null,
      framecounter: 0,
      complete: false,
      
      reset: function reset()
      {
         this.framecounter = 0;
         this.complete = false;
      }
   };
})();


/**
 * Actor base class.
 * 
 * Game actors have a position in the game world and a current vector to indicate
 * direction and speed of travel per frame. They each support the onUpdate() and
 * onRender() event methods, finally an actor has an expired() method which should
 * return true when the actor object should be removed from play.
 * 
 * An actor can be hit and destroyed by bullets or similar. The class supports a hit()
 * method which should return true when the actor should be removed from play.
 * 
 * @namespace Game
 * @class Game.Actor
 */
(function()
{
   Game.Actor = function(p, v)
   {
      this.position = p;
      this.vector = v;
      
      return this;
   };
   
   Game.Actor.prototype =
   {
      /**
       * Actor position
       *
       * @property position
       * @type Vector
       */
      position: null,
      
      /**
       * Actor vector
       *
       * @property vector
       * @type Vector
       */
      vector: null,
      
      /**
       * Alive flag
       *
       * @property alive
       * @type boolean
       */
      alive: true,
      
      /**
       * Radius - default is zero to imply that it is not affected by collision tests etc.
       *
       * @property radius
       * @type int
       */
      radius: 0,
      
      /**
       * Actor expiration test
       * 
       * @method expired
       * @return true if expired and to be removed from the actor list, false if still in play
       */
      expired: function expired()
      {
         return !(this.alive);
      },
      
      /**
       * Hit by bullet
       * 
       * @param force of the impacting bullet (as the actor may support health)
       * @return true if destroyed, false otherwise
       */
      hit: function hit(force)
      {
         this.alive = false;
         return true;
      },
      
      /**
       * Transform current position vector from world coordinates to screen.
       * Applies the appropriate translation and scaling to the canvas context.
       * 
       * @method worldToScreen
       * @return Vector or null if non visible
       */
      worldToScreen: function worldToScreen(ctx, world, radius)
      {
         var viewposition = Game.worldToScreen(this.position, world, radius);
         if (viewposition)
         {
            // scale ALL graphics... - translate to position apply canvas scaling
            ctx.translate(viewposition.x, viewposition.y);
            ctx.scale(world.scale, world.scale);
         }
         return viewposition;
      },
      
      /**
       * Actor game loop update event method. Called for each actor
       * at the start of each game loop cycle.
       * 
       * @method onUpdate
       */
      onUpdate: function onUpdate()
      {
      },
      
      /**
       * Actor rendering event method. Called for each actor to
       * render for each frame.
       * 
       * @method onRender
       * @param ctx {object} Canvas rendering context
       * @param world {object} World metadata
       */
      onRender: function onRender(ctx, world)
      {
      }
   };
})();


/**
 * SpriteActor base class.
 * 
 * An actor that can be rendered by a bitmap. The sprite handling code deals with the increment
 * of the current frame within the supplied bitmap sprite strip image, based on animation direction,
 * animation speed and the animation length before looping. Call renderSprite() each frame.
 * 
 * NOTE: by default sprites source images are 64px wide 64px by N frames high and scaled to the
 * appropriate final size. Any other size input source should be set in the constructor.
 * 
 * @namespace Game
 * @class Game.SpriteActor
 */
(function()
{
   Game.SpriteActor = function(p, v, s)
   {
      Game.SpriteActor.superclass.constructor.call(this, p, v);
      if (s) this.frameSize = s;
      
      return this;
   };
   
   extend(Game.SpriteActor, Game.Actor,
   {
      /**
       * Size in pixels of the width/height of an individual frame in the image
       */
      frameSize: 64,
      
      /**
       * Animation image sprite reference.
       * Sprite image sources are all currently 64px wide 64px by N frames high.
       */
      animImage: null,
      
      /**
       * Length in frames of the sprite animation
       */
      animLength: 0,
      
      /**
       * Animation direction, true for forward, false for reverse.
       */
      animForward: true,
      
      /**
       * Animation frame inc/dec speed.
       */
      animSpeed: 1.0,
      
      /**
       * Current animation frame index
       */
      animFrame: 0,
      
      /**
       * TODO: convert to use new world->view transformation!
       * 
       * Render sprite graphic based on current anim image, frame and anim direction
       * Automatically updates the current anim frame.
       * 
       * Optionally this method will automatically correct for objects moving on/off
       * a cyclic canvas play area - if so it will render the appropriate stencil
       * sections of the sprite top/bottom/left/right as needed to complete the image.
       * Note that this feature can only be used if the sprite is absolutely positioned
       * and not translated/rotated into position by canvas operations.
       */
      renderSprite: function renderSprite(ctx, x, y, w, cyclic)
      {
         var offset = this.animFrame << 6,
             fs = this.frameSize;
         
         ctx.drawImage(this.animImage, 0, offset, fs, fs, x, y, w, w);
         
         if (cyclic)
         {
            if (x < 0 || y < 0)
            {
               ctx.drawImage(this.animImage, 0, offset, fs, fs,
                  (x < 0 ? (GameHandler.width + x) : x),
                  (y < 0 ? (GameHandler.height + y) : y),
                  w, w);
            }
            if (x + w >= GameHandler.width || y + w >= GameHandler.height)
            {
               ctx.drawImage(this.animImage, 0, offset, fs, fs,
                  (x + w >= GameHandler.width ? (x - GameHandler.width) : x),
                  (y + w >= GameHandler.height ? (y - GameHandler.height) : y),
                  w, w);
            }
         }
         
         // update animation frame index
         if (this.animForward)
         {
            this.animFrame += this.animSpeed;
            if (this.animFrame >= this.animLength)
            {
               this.animFrame = 0;
            }
         }
         else
         {
            this.animFrame -= this.animSpeed;
            if (this.animFrame < 0)
            {
               this.animFrame = this.animLength - 1;
            }
         }
      }
   });
})();


/**
 * EffectActor base class.
 * 
 * An actor representing a transient effect in the game world. An effect is nothing more than
 * a special graphic that does not play any direct part in the game and does not interact with
 * any other objects. It automatically expires after a set lifespan, generally the rendering of
 * the effect is based on the remaining lifespan.
 * 
 * @namespace Game
 * @class Game.EffectActor
 */
(function()
{
   Game.EffectActor = function(p, v, lifespan)
   {
      Game.EffectActor.superclass.constructor.call(this, p, v);
      this.lifespan = lifespan;
      return this;
   };
   
   extend(Game.EffectActor, Game.Actor,
   {
      /**
       * Effect lifespan remaining
       */
      lifespan: 0,
      
      /**
       * Actor expiration test
       * 
       * @return true if expired and to be removed from the actor list, false if still in play
       */
      expired: function expired()
      {
      	// deduct lifespan from the explosion
      	return (--this.lifespan === 0);
      }
   });
})();


/**
 * Image Preloader class. Executes the supplied callback function once all
 * registered images are loaded by the browser.
 * 
 * @namespace Game
 * @class Game.Preloader
 */
(function()
{
   Game.Preloader = function()
   {
      this.images = [];
      return this;
   };
   
   Game.Preloader.prototype =
   {
      /**
       * Image list
       *
       * @property images
       * @type Array
       */
      images: null,
      
      /**
       * Callback function
       *
       * @property callback
       * @type Function
       */
      callback: null,
      
      /**
       * Images loaded so far counter
       */
      counter: 0,
      
      /**
       * Add an image to the list of images to wait for
       */
      addImage: function addImage(img, url)
      {
         var me = this;
         img.url = url;
         // attach closure to the image onload handler
         img.onload = function()
         {
            me.counter++;
            if (me.counter === me.images.length)
            {
               // all images are loaded - execute callback function
               me.callback.call(me);
            }
         };
         this.images.push(img);
      },
      
      /**
       * Load the images and call the supplied function when ready
       */
      onLoadCallback: function onLoadCallback(fn)
      {
         this.counter = 0;
         this.callback = fn;
         // load the images
         for (var i=0, j=this.images.length; i<j; i++)
         {
            this.images[i].src = this.images[i].url;
         }
      }
   };
})();


/**
 * Render text into the canvas context.
 * Compatible with FF3.5, SF4, GC4, OP10
 * 
 * @method Game.drawText
 * @static
 */
Game.drawText = function(g, txt, font, x, y, col)
{
   g.save();
   if (col) g.strokeStyle = col;
   g.font = font;
   g.strokeText(txt, x, y);
   g.restore();
};

Game.fillText = function(g, txt, font, x, y, col)
{
   g.save();
   if (col) g.fillStyle = col;
   g.font = font;
   g.fillText(txt, x, y);
   g.restore();
};

Game.centerFillText = function(g, txt, font, y, col)
{
   g.save();
   if (col) g.fillStyle = col;
   g.font = font;
   g.fillText(txt, (GameHandler.width - g.measureText(txt).width) / 2, y);
   g.restore();
};

Game.fontSize = function fontSize(world, size)
{
   var s = ~~(size * world.scale * 2);
   if (s > 20) s = 20;
   else if (s < 8) s = 8;
   return s;
};

Game.fontFamily = function fontFamily(world, size, font)
{
   return Game.fontSize(world, size) + "pt " + (font ? font : "Courier New");
};