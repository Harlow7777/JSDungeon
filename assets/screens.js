Game.Screen = {
};

// Define our initial start screen
Game.Screen.startScreen = {
	_subScreen: null,
    enter: function() {    
    	console.log("Entered start screen."); 
    },
    exit: function() { console.log("Exited start screen."); },
    render: function(display) {
    	if (this._subScreen) {
            this._subScreen.render(display);
            return;
        }
        // Render our prompt to the screen
    	var titleArray = ["Welcome to Javascript Roguelike!", "Press any key to start"];
    	var formatting = "%c{yellow}";
    	var height = titleArray.length;
    	for (var i = 0, len = titleArray.length; i < len; i++) {
    		var title = titleArray[i];
    		display.drawText((Game._screenWidth/2)-(title.length/2), (Game._screenHeight/2)-height, formatting + title);
    		height--;
    	}
    },
    handleInput: function(inputType, inputData) {
        if (inputType === 'keydown') {
        	if(!this._subScreen){
        		this.setSubScreen(Game.Screen.helpScreen);
        	} else {
        		Game.switchScreen(Game.Screen.playScreen);
        	}
        }
    },
    setSubScreen: function(subScreen) {
        this._subScreen = subScreen;
        Game.refresh();
    },
};

// Define our playing screen
Game.Screen.playScreen = {
    _player: null,
    _target: null,
    _gameEnded: false,
    _subScreen: null,
    _charName: 'Hero',
    _index: 0,
    enter: function() {
    	this._charName = prompt("Enter hero's name: ", "");
        // Create a map based on our size parameters
        var width = 100;//100
        var height = 50;//48
        var depth = 6;
        // Create our map from the tiles and player
        this._player = new Game.Entity(Game.PlayerTemplate);
        var tiles = new Game.Builder(width, height, depth).getTiles();
        var map = new Game.Map.Cave(tiles, this._player);
        // Start the map's engine
        map.getEngine().start();
    },
    exit: function() { console.log("Exited play screen."); },
    render: function(display) {
        // Render subscreen if there is one
        if (this._subScreen) {
            this._subScreen.render(display);
            return;
        }

        var screenWidth = Game.getScreenWidth();
        var screenHeight = Game.getScreenHeight();

        // Render the tiles
        this.renderTiles(display);

        // Get the messages in the player's queue and render them
        var messages = this._player.getMessages();
        var messageY = 0;
        for (var i = 0; i < messages.length; i++) {
            // Draw each message, adding the number of lines
            messageY += display.drawText(
                0, 
                messageY,
                '%c{white}%b{black}' + messages[i]
            );
        }
        // Render player stats
        var stats = '%c{white}%b{black}';
        var char = 'Hero';
        if(this._charName) {
        	char = this._charName;
        }
        stats += vsprintf('%s Lvl.%d HP: %d/%d XP: %d/%d',
            [char, this._player.getLevel(),
             this._player.getHp(), this._player.getMaxHp(), 
             this._player.getExperience(), this._player.getNextLevelExperience()]);
        display.drawText(0, screenHeight-1, stats);
        var equip = vsprintf('ATK: %d Sight: %d StatPoints: %d', [this._player.getAttackValue(), this._player.getSightRadius(), this._player.getStatPoints()]);
        var armor = this._player.getArmor();
        var weapon = this._player.getWeapon();
        if(armor) {
        	equip += vsprintf(' Wearing: %s', [armor.describe()]);
        }
        if(weapon) {
        	equip += vsprintf(' Wielding: %s', [weapon.describe()]);
        }
        display.drawText(0, screenHeight, equip);
        // Render hunger state
        var hungerState = this._player.getHungerState();
        if(hungerState === 'Not Hungry') {
        	hungerState = "%c{green}" + hungerState;
        } else if(hungerState === 'Hungry') {
        	hungerState = "%c{yellow}" + hungerState;
        } else {
        	hungerState = "%c{red}" + hungerState;
        }
        display.drawText(screenWidth - hungerState.length, screenHeight, hungerState);
    },
	getScreenOffsets: function() {
        // Make sure we still have enough space to fit an entire game screen
        var topLeftX = Math.max(0, this._player.getX() - (Game.getScreenWidth() / 2));
        // Make sure we still have enough space to fit an entire game screen
        topLeftX = Math.min(topLeftX, this._player.getMap().getWidth() -
            Game.getScreenWidth());
        // Make sure the y-axis doesn't above the top bound
        var topLeftY = Math.max(0, this._player.getY() - (Game.getScreenHeight() / 2));
        // Make sure we still have enough space to fit an entire game screen
        topLeftY = Math.min(topLeftY, this._player.getMap().getHeight() - Game.getScreenHeight());
        return {
            x: topLeftX,
            y: topLeftY
        };
    },
	renderTiles: function(display) {
        var screenWidth = Game.getScreenWidth();
        var screenHeight = Game.getScreenHeight();
        var offsets = this.getScreenOffsets();
        var topLeftX = offsets.x;
        var topLeftY = offsets.y;
        // This object will keep track of all visible map cells
        var visibleCells = {};
        // Store this._player.getMap() and player's z to prevent losing it in callbacks
        var map = this._player.getMap();
        var currentDepth = this._player.getZ();
        // Find all visible cells and update the object
        map.getFov(currentDepth).compute(
            this._player.getX(), this._player.getY(), 
            this._player.getSightRadius(), 
            function(x, y, radius, visibility) {
                visibleCells[x + "," + y] = true;
                // Mark cell as explored
                map.setExplored(x, y, currentDepth, true);
            });
        // Render the explored map cells
        for (var x = topLeftX; x < topLeftX + screenWidth; x++) {
            for (var y = topLeftY; y < topLeftY + screenHeight; y++) {
                if (map.isExplored(x, y, currentDepth)) {
                    // Fetch the glyph for the tile and render it to the screen
                    // at the offset position.
                    var glyph = map.getTile(x, y, currentDepth);
                    var foreground = glyph.getForeground();
                    // If we are at a cell that is in the field of vision, we need
                    // to check if there are items or entities.
                    if (visibleCells[x + ',' + y]) {
                        // Check for items first, since we want to draw entities
                        // over items.
                        var items = map.getItemsAt(x, y, currentDepth);
                        // If we have items, we want to render the top most item
                        if (items) {
                            glyph = items[items.length - 1];
                        }
                        // Check if we have an entity at the position
                        if (map.getEntityAt(x, y, currentDepth)) {
                            glyph = map.getEntityAt(x, y, currentDepth);
                        }
                        // Update the foreground color in case our glyph changed
                        foreground = glyph.getForeground();
                    } else {
                        // Since the tile was previously explored but is not 
                        // visible, we want to change the foreground color to
                        // dark gray.
                        foreground = 'darkGray';
                    }
                    display.draw(
                        x - topLeftX,
                        y - topLeftY,
                        glyph.getChar(), 
                        foreground, 
                        glyph.getBackground());
                }
            }
        }
	},
    handleInput: function(inputType, inputData) {
        // If the game is over, enter will bring the user to the losing screen.
        if (this._gameEnded) {
            if (inputType === 'keydown' && inputData.keyCode === ROT.VK_RETURN) {
                Game.switchScreen(Game.Screen.loseScreen);
            }
            // Return to make sure the user can't still play
            return;
        }
        // Handle subscreen input if there is one
        if (this._subScreen) {
            this._subScreen.handleInput(inputType, inputData);
            return;
        }
        if (inputType === 'keydown') {
            // Movement
            if (inputData.keyCode === ROT.VK_A) {
                this.move(-1, 0, 0);
            } else if (inputData.keyCode === ROT.VK_D) {
                this.move(1, 0, 0);
            } else if (inputData.keyCode === ROT.VK_W) {
                this.move(0, -1, 0);
            } else if (inputData.keyCode === ROT.VK_S) {
                this.move(0, 1, 0);
            } else if (inputData.keyCode === ROT.VK_I) {
                // Show the inventory screen
                this.showItemsSubScreen(Game.Screen.inventoryScreen, this._player.getItems(),
                    'You are not carrying anything.');
                return;
            } else if (inputData.keyCode === ROT.VK_L) {
            	if(this._player.getStatPoints() === 0) {
            		Game.sendMessage(this._player, 'You have 0 stat points.');
                    Game.refresh();
            	} else {
            		Game.Screen.gainStatScreen.setup(this._player);
            		this.setSubScreen(Game.Screen.gainStatScreen);
            	}
            	return;
			} else if (inputData.keyCode === ROT.VK_X) {
                // Show the drop screen
                this.showItemsSubScreen(Game.Screen.examineScreen, this._player.getItems(),
                   'You have nothing to examine.');
                return;
            } else if (inputData.keyCode === ROT.VK_P) {
                var items = this._player.getMap().getItemsAt(this._player.getX(), 
                    this._player.getY(), this._player.getZ());
                // If there is only one item, directly pick it up
                if (items && items.length === 1) {
                    var item = items[0];
                    if (this._player.pickupItems([0])) {
                        Game.sendMessage(this._player, "You pick up %s.", [item.describeA()]);
                    } else {
                        Game.sendMessage(this._player, "Your inventory is full! Nothing was picked up.");
                    }
                // Else open pickup screen
                } else if(items && items.length > 1) {
	            	 if (!this._player.pickupItems(Object.keys(items))) {
	                     Game.sendMessage(this._player, "Your inventory is full! Not all items were picked up.");
	                 }
                } else {
                	this.showItemsSubScreen(Game.Screen.pickupScreen, items,
                    'There is nothing here to pick up.');
                	return;
                }sss
            } else {
                // Not a valid key
                return;
            }
            // Unlock the engine
            this._player.getMap().getEngine().unlock();
        } else if (inputType === 'keypress') {
            var keyChar = String.fromCharCode(inputData.charCode);
            if (keyChar === ';') {
                // Setup the look screen.
                var offsets = this.getScreenOffsets();
                Game.Screen.lookScreen.setup(this._player,
                    this._player.getX(), this._player.getY(),
                    offsets.x, offsets.y);
                this.setSubScreen(Game.Screen.lookScreen);
                return;
            } else if (keyChar === '?') {
                // Setup the look screen.
                this.setSubScreen(Game.Screen.helpScreen);
                return;
            } else {
                // Not a valid key
                return;
            }
            // Unlock the engine
            this._player.getMap().getEngine().unlock();
        } 
    	_currTile = this._player.getMap().getTile(this._player.getX(), this._player.getY(), this._player.getZ());
        if (_currTile === Game.Tile.holeToCavernTile || _currTile === Game.Tile.stairsDownTile) {
			this.move(0, 0, 1);
			// Unlock the engine
            this._player.getMap().getEngine().unlock();
		} else if(_currTile === Game.Tile.stairsUpTile) {
			this.move(0, 0, -1);
			// Unlock the engine
            this._player.getMap().getEngine().unlock();
		}
    },
    move: function(dX, dY, dZ) {
        var newX = this._player.getX() + dX;
        var newY = this._player.getY() + dY;
        var newZ = this._player.getZ() + dZ;
        // Try to move to the new cell
        this._player.tryMove(newX, newY, newZ, this._player.getMap());
    },
    setGameEnded: function(gameEnded) {
        this._gameEnded = gameEnded;
    },
    setSubScreen: function(subScreen) {
        this._subScreen = subScreen;
        // Refresh screen on changing the subscreen
        Game.refresh();
    },
    showItemsSubScreen: function(subScreen, items, emptyMessage) {
        if (items && subScreen.setup(this._player, items) > 0) {
            this.setSubScreen(subScreen);
        } else {
            Game.sendMessage(this._player, emptyMessage);
            Game.refresh();
        }
    }
};

// Define our winning screen
Game.Screen.winScreen = {
    enter: function() { console.log("Entered win screen."); },
    exit: function() { console.log("Exited win screen."); },
    render: function(display) {
        // Render our prompt to the screen
        for (var i = 0; i < 22; i++) {
            // Generate random background colors
            var r = Math.round(Math.random() * 255);
            var g = Math.round(Math.random() * 255);
            var b = Math.round(Math.random() * 255);
            var background = ROT.Color.toRGB([r, g, b]);
            display.drawText(2, i + 1, "%b{" + background + "}You win!");
        }
    },
    handleInput: function(inputType, inputData) {
        // Nothing to do here      
    }
};

// Define our winning screen
Game.Screen.loseScreen = {
    enter: function() {    console.log("Entered lose screen."); },
    exit: function() { console.log("Exited lose screen."); },
    render: function(display) {
        // Render our prompt to the screen
        for (var i = 0; i < 22; i++) {
            display.drawText(2, i + 1, "%b{red}You lose! :( Enter to Restart");
        }
    },
    handleInput: function(inputType, inputData) {
    	if(inputType === 'keydown'){
    		if(inputData.keyCode === ROT.VK_RETURN){
    			window.location.reload(false);
    		}
    	}
    }
};

Game.Screen.ItemListScreen = function(template) {
    // Set up based on the template
    this._caption = template['caption'];
    this._okFunction = template['ok'];
    this._index = 0;
    // By default, we use the identity function
    this._isAcceptableFunction = template['isAcceptable'] || function(x) {
        return x;
    }
    // Whether the user can select items at all.
    this._canSelectItem = template['canSelect'];
    // Whether the user can select multiple items.
    this._canSelectMultipleItems = template['canSelectMultipleItems'];
    // Whether a 'no item' option should appear.
    this._hasNoItemOption = template['hasNoItemOption'];
};

Game.Screen.ItemListScreen.prototype.setup = function(player, items) {
    this._player = player;
    // Should be called before switching to the screen.
    var count = 0;
    // Iterate over each item, keeping only the acceptable ones and counting
    // the number of acceptable items.
    var that = this;
    this._items = items.map(function(item) {
        // Transform the item into null if it's not acceptable
        if (that._isAcceptableFunction(item)) {
            count++;
            return item;
        } else {
            return null;
        }
    });
    // Clean set of selected indices
    this._selectedIndices = {};
    return count;
};

Game.Screen.ItemListScreen.prototype.render = function(display) {
    var letters = 'abcdefghijklmnopqrstuvwxyz';
    // Render the caption in the top row
    display.drawText(0, 0, this._caption);
    // Render the no item row if enabled
    if (this._hasNoItemOption && this._index === 0) {
        display.drawText(0, 1, '0 + nothing');
    } else if(this._hasNoItemOption) {
        display.drawText(0, 1, '0 - nothing');
    }
    var row = 0;
    for (var i = 0; i < this._items.length; i++) {
        // If we have an item, we want to render it.
        if (this._items[i]) {
            // Get the letter matching the item's index
            var letter = letters.substring(i, i + 1);
            // Check if the item is worn or wielded
            var suffix = '';
            if (this._items[i] === this._player.getArmor()) {
                suffix = ' (wearing)';
            } else if (this._items[i] === this._player.getWeapon()) {
                suffix = ' (wielding)';
            }
            // Render at the correct row and add 2.
            if(row+1 === this._index) {
            	display.drawText(0, 2 + row,  letter + ' + ' +
            			this._items[i].describe() + suffix);
            } else {
            	display.drawText(0, 2 + row,  letter + ' - ' +
            			this._items[i].describe() + suffix);
            }
            row++;
        }
    }
};

Game.Screen.ItemListScreen.prototype.executeOkFunction = function() {
    // Gather the selected items.
    var selectedItems = {};
    for (var key in this._selectedIndices) {
        selectedItems[key] = this._items[key];
    }
    // Switch back to the play screen.
    Game.Screen.playScreen.setSubScreen(undefined);
    // Call the OK function and end the player's turn if it return true.
    if (this._okFunction(selectedItems)) {
        this._player.getMap().getEngine().unlock();
    }
};

Game.Screen.ItemListScreen.prototype.handleInput = function(inputType, inputData) {
    if (inputType === 'keydown') {
    	// If the user hit escape, hit enter and can't select an item, or hit
        // enter without any items selected, simply cancel out
        if (inputData.keyCode === ROT.VK_ESCAPE && 
            (!this._canSelectItem || Object.keys(this._selectedIndices).length === 0)) {
            Game.Screen.playScreen.setSubScreen(undefined);
            this._index = 0;
        // Handle pressing zero when 'no item' selection is enabled
        } else if (this._canSelectItem && this._hasNoItemOption && inputData.keyCode === ROT.VK_RETURN && this._index === 0) {
        	this._selectedIndices = {};
            this._index = 0;
            this.executeOkFunction();
        // Move down
        } else if (this._canSelectItem && inputData.keyCode === ROT.VK_S) {
            if(this._items[this._index]) {
        		this._index++;
        	}
        // Move up
        } else if (this._canSelectItem && inputData.keyCode === ROT.VK_W) {
        	if(this._index > 0) {
        		this._index--;
        	}
        // Handle pressing a letter if we can select
        } else if (this._canSelectItem && inputData.keyCode === ROT.VK_RETURN) {
            // Check if it maps to a valid item by subtracting 'a' from the character
            // to know what letter of the alphabet we used.
        	var index = this._index-1;
            if (this._items[index]) {
                // If multiple selection is allowed, toggle the selection status, else
                // select the item and exit the screen
                if (this._canSelectMultipleItems) {
                    if (this._selectedIndices[index]) {
                        delete this._selectedIndices[index];
                    } else {
                        this._selectedIndices[index] = true;
                    }
                } else {
                    this._selectedIndices[index] = true;
                    this.executeOkFunction();
                }
            }
        }
    }
    Game.refresh();
};

Game.Screen.inventoryScreen = new Game.Screen.ItemListScreen({
	caption: 'Choose the item',
    canSelect: true,
    canSelectMultipleItems: false,
    hasNoItemOption: true,
});

Game.Screen.inventoryScreen.handleInput = function(inputType, inputData) {
	this.setup(this._player, this._player.getItems());
    if (inputType === 'keydown') {
        // If the user hit escape, hit enter and can't select an item, or hit
        // enter without any items selected, simply cancel out
        if (inputData.keyCode === ROT.VK_ESCAPE && 
            (!this._canSelectItem || Object.keys(this._selectedIndices).length === 0)) {
            Game.Screen.playScreen.setSubScreen(undefined);
            this._index = 0;
        // Handle pressing zero when 'no item' selection is enabled
        } else if (this._canSelectItem && this._hasNoItemOption && inputData.keyCode === ROT.VK_RETURN && this._index === 0) {
        	this._selectedIndices = {};
            this._index = 0;
            this.executeOkFunction();
        // Move down
        } else if (this._canSelectItem && inputData.keyCode === ROT.VK_S) {
            if(this._player.getItems()[this._index]) {
        		this._index++;
        	}
        // Move up
        } else if (this._canSelectItem && inputData.keyCode === ROT.VK_W) {
        	if(this._index > 0) {
        		this._index--;
        	}
        // Handle pressing a letter if we can select
        } else if (this._canSelectItem && inputData.keyCode === ROT.VK_RETURN) {
            // Check if it maps to a valid item by subtracting 'a' from the character
            // to know what letter of the alphabet we used.
        	var index = this._index-1;
            if (this._items[index]) {
                this._selectedIndices[index] = true;
                var item;
                for (var key in this._selectedIndices) {
                	item = this._items[key];
                }
            	var actionList = ["examine","drop"];
            	if(item.hasMixin("Edible")){
                	actionList.push("eat");
            	}
            	if(item.hasMixin("Equippable")){
            		if(item.isWearable()){
            			actionList.push("wear");
            		} 
            		if(item.isWieldable()) {
            			actionList.push("wield");
            		}
            	}
            	if (actionList && Game.Screen.actionScreen.setup(this._player, actionList, item) > 0) {
            		Game.Screen.playScreen.setSubScreen(Game.Screen.actionScreen);
                } else {
                    Game.sendMessage(this._player, 'You can\'t do anything with this item.');
                }
            }
            this._index = 0;
        }
    }
    Game.refresh();
};

Game.Screen.actionScreen = new Game.Screen.ItemListScreen({
	caption: 'Choose what to do with this item',
	canSelect: true,
	canSelectMultipleItems: false,
	hasNoItemOption: true,
	ok : function(selectedItems) {
		var message = "";
		var key = Object.keys(selectedItems)[0];
		var targetKey = this._player.getItems().indexOf(this._target);
        var action = selectedItems[key];
        if(action === 'drop') {
	        this._player.dropItem(targetKey);
	        message = vsprintf("You drop %s.", [this._target.describeA()]);
        } else if(action === 'examine') {
        	message = vsprintf("It's %s (%s).", 
                [
                    this._target.describeA(),
                    this._target.details()
                ]);
		} else if(action === 'eat' && this._target.hasMixin('Edible')) {
	        this._target.eat(this._player);
	        if (!this._target.hasRemainingConsumptions()) {
	            this._player.removeItem(targetKey);
	        }
	        message = vsprintf("You eat %s.", [this._target.describeA()]);
		} else if(action === 'wear' && this._target.hasMixin('Equippable') && this._target.isWearable()) {
			if(this._player.getArmor() === this._target) {
				this._player.unequip(this._target);
				message = vsprintf("You take off %s.", [this._target.describeThe()]);
			} else {
				this._player.unequip(this._target);
				this._player.wear(this._target);
				message = vsprintf("You are wearing %s.", [this._target.describeThe()]);
			}
		} else if(action === 'wield' && this._target.hasMixin('Equippable') && this._target.isWieldable()) {
            if(this._player.getWeapon() === this._target) {
            	this._player.unequip(this._target);
            	if(this._target.describe() === 'torch'){
            		this._player.increaseSightRadius(-3);
            	}
            	message = vsprintf("You put down %s.", [this._target.describeThe()]);
            } else {
            	this._player.unequip(this._target);
            	this._player.wield(this._target);
            	if(this._target.describe() === 'torch'){
            		this._player.increaseSightRadius(3);
            		message = vsprintf("The cave lights up!")
            	}
            	message = vsprintf("You are wielding %s.", [this._target.describeThe()]);
            }
		}
        Game.sendMessage(this._player, message);
	}
});

Game.Screen.actionScreen.setup = function(player, items, target) {
    this._player = player;
    // Should be called before switching to the screen.
    var count = 0;
    var that = this;
    this._index = 0;
    this._target = target;
    this._items = items.map(function(action) {
        count++;
        return action;
    });
    // Clean set of selected indices
    this._selectedIndices = {};
    return count;
};

Game.Screen.actionScreen.render = function(display) {
    var letters = 'abcdefghijklmnopqrstuvwxyz';
    // Render the caption in the top row
    display.drawText(0, 0, this._caption);
    // Render the no item row if enabled
    if (this._hasNoItemOption && this._index === 0) {
        display.drawText(0, 1, '0 + nothing');
    } else if(this._hasNoItemOption) {
        display.drawText(0, 1, '0 - nothing');
    }
    var row = 0;
    for (var i = 0; i < this._items.length; i++) {
        // If we have an item, we want to render it.
        if (this._items[i]) {
            // Get the letter matching the item's index
            var letter = letters.substring(i, i + 1);
            // Render at the correct row and add 2.
            if(row+1 === this._index) {
            	display.drawText(0, 2 + row,  letter + ' + ' +
            			this._items[i]);
            } else {
            	display.drawText(0, 2 + row,  letter + ' - ' +
            			this._items[i]);
            }
            row++;
        }
    }
};

Game.Screen.pickupScreen = new Game.Screen.ItemListScreen({
    caption: 'Choose the items you wish to pickup',
    canSelect: true,
    canSelectMultipleItems: true,
    ok: function(selectedItems) {
        // Try to pick up all items, messaging the player if they couldn't all be
        // picked up.
        if (!this._player.pickupItems(Object.keys(selectedItems))) {
            Game.sendMessage(this._player, "Your inventory is full! Not all items were picked up.");
        }
        return true;
    }
});

Game.Screen.gainStatScreen = {
	canSelectItem: true,
    setup: function(entity) {
        // Must be called before rendering.
        this._entity = entity;
        this._options = entity.getStatOptions();
        this._optionsText = entity.getStatOptionsText();
        this._index = 0;
    },
    render: function(display) {
        display.drawText(0, 0, 'Choose a stat to increase: ');
        var letters = 'abcdefghijklmnopqrstuvwxyz';
        // Render the no item row
        if (this._index === 0) {
            display.drawText(0, 1, '0 + nothing');
        } else {
            display.drawText(0, 1, '0 - nothing');
        }
        var row = 0;
        for (var i = 0; i < this._options.length; i++) {
            // If we have an item, we want to render it.
            if (this._options[i]) {
                // Get the letter matching the item's index
                var letter = letters.substring(i, i + 1);
                // Render at the correct row and add 2.
                if(row+1 === this._index) {
                	display.drawText(0, 2 + row,  letter + ' + ' +
                			this._optionsText[i]);
                } else {
                	display.drawText(0, 2 + row,  letter + ' - ' +
                			this._optionsText[i]);
                }
                row++;
            }
        }
    },
    handleInput: function(inputType, inputData) {
    	if (inputType === 'keydown') {
        	// If the user hit escape, or hit
            // enter without any items selected, simply cancel out
            if (inputData.keyCode === ROT.VK_ESCAPE) {
                Game.Screen.playScreen.setSubScreen(undefined);
                this._index = 0;
            // Handle pressing enter when 'no item' selection is enabled
            } else if (inputData.keyCode === ROT.VK_RETURN && this._index === 0) {
            	this._selectedIndices = {};
                this._index = 0;
                this.executeOkFunction();
            // Move down
            } else if (inputData.keyCode === ROT.VK_S) {
                if(this._options[this._index]) {
            		this._index++;
            	}
            // Move up
            } else if (inputData.keyCode === ROT.VK_W) {
            	if(this._index > 0) {
            		this._index--;
            	}
            // Handle pressing enter
            } else if (inputData.keyCode === ROT.VK_RETURN) {
            	var index = this._index-1;
                if (this._options[index]) {
                    this.executeOkFunction(index);
                }
            }
        }
        Game.refresh();
    },
    ok: function(selectedItems, index) {
        if (this._options[index] && this._entity.getStatPoints() > 0) {
            // Call the stat increasing function
            this._options[index][1].call(this._entity);
            // Decrease stat points
            this._entity.setStatPoints(this._entity.getStatPoints() - 1);
            // If we have no stat points left, exit the screen, else refresh
            if (this._entity.getStatPoints() == 0) {
                Game.Screen.playScreen.setSubScreen(undefined);
            } else {
                Game.refresh();
            }
        }
    },
    executeOkFunction: function(index) {
        // Gather the selected items.
        var selectedItems = {};
        selectedItems[index] = this._options[index];
        // Switch back to the play screen.
        Game.Screen.playScreen.setSubScreen(undefined);
        // Call the OK function and end the player's turn if it return true.
        if (this.ok(selectedItems, index)) {
            this._player.getMap().getEngine().unlock();
        }
    }
};

Game.Screen.TargetBasedScreen = function(template) {
    template = template || {};
    // By default, our ok return does nothing and does not consume a turn.
    this._isAcceptableFunction = template['okFunction'] || function(x, y) {
        return false;
    };
    // The defaut caption function simply returns an empty string.
    this._captionFunction = template['captionFunction'] || function(x, y) {
        return '';
    }
};

Game.Screen.TargetBasedScreen.prototype.setup = function(player, startX, startY, offsetX, offsetY) {
    this._player = player;
    // Store original position. Subtract the offset to make life easy so we don't
    // always have to remove it.
    this._startX = startX - offsetX;
    this._startY = startY - offsetY;
    // Store current cursor position
    this._cursorX = this._startX;
    this._cursorY = this._startY;
    // Store map offsets
    this._offsetX = offsetX;
    this._offsetY = offsetY;
    // Cache the FOV
    var visibleCells = {};
    this._player.getMap().getFov(this._player.getZ()).compute(
        this._player.getX(), this._player.getY(), 
        this._player.getSightRadius(), 
        function(x, y, radius, visibility) {
            visibleCells[x + "," + y] = true;
        });
    this._visibleCells = visibleCells;
};

Game.Screen.TargetBasedScreen.prototype.render = function(display) {
    Game.Screen.playScreen.renderTiles.call(Game.Screen.playScreen, display);

	 display.drawText(this._cursorX, this._cursorY, '%c{magenta}*');

    // Render the caption at the bottom.
    display.drawText(0, Game.getScreenHeight() - 1, 
        this._captionFunction(this._cursorX + this._offsetX, this._cursorY + this._offsetY));
};

Game.Screen.TargetBasedScreen.prototype.handleInput = function(inputType, inputData) {
    // Move the cursor
    if (inputType == 'keydown') {
        if (inputData.keyCode === ROT.VK_A) {
            this.moveCursor(-1, 0);
        } else if (inputData.keyCode === ROT.VK_D) {
            this.moveCursor(1, 0);
        } else if (inputData.keyCode === ROT.VK_W) {
            this.moveCursor(0, -1);
        } else if (inputData.keyCode === ROT.VK_S) {
            this.moveCursor(0, 1);
        } else if (inputData.keyCode === ROT.VK_ESCAPE) {
            Game.Screen.playScreen.setSubScreen(undefined);
        } else if (inputData.keyCode === ROT.VK_RETURN) {
            this.executeOkFunction();
        }
    }
    Game.refresh();
};

Game.Screen.TargetBasedScreen.prototype.moveCursor = function(dx, dy) {
    // Make sure we stay within bounds.
    this._cursorX = Math.max(0, Math.min(this._cursorX + dx, Game.getScreenWidth()));
    // We have to save the last line for the caption.
    this._cursorY = Math.max(0, Math.min(this._cursorY + dy, Game.getScreenHeight() - 1));
};

Game.Screen.TargetBasedScreen.prototype.executeOkFunction = function() {
    // Switch back to the play screen.
    Game.Screen.playScreen.setSubScreen(undefined);
    // Call the OK function and end the player's turn if it return true.
    if (this._okFunction(this._cursorX + this._offsetX, this._cursorY + this._offsetY)) {
        this._player.getMap().getEngine().unlock();
    }
};

Game.Screen.lookScreen = new Game.Screen.TargetBasedScreen({
    captionFunction: function(x, y) {
        var z = this._player.getZ();
        var map = this._player.getMap();
        // If the tile is explored, we can give a better caption
        if (map.isExplored(x, y, z)) {
            // If the tile isn't explored, we have to check if we can actually 
            // see it before testing if there's an entity or item.
            if (this._visibleCells[x + ',' + y]) {
                var items = map.getItemsAt(x, y, z);
                // If we have items, we want to render the top most item
                if (items) {
                    var item = items[items.length - 1];
                    return String.format('%s - %s (%s)',
                        item.getRepresentation(),
                        item.describeA(true),
                        item.details());
                // Else check if there's an entity
                } else if (map.getEntityAt(x, y, z)) {
                    var entity = map.getEntityAt(x, y, z);
                    return String.format('%s - %s (%s)',
                        entity.getRepresentation(),
                        entity.describeA(true),
                        entity.details());
                }
            }
            // If there was no entity/item or the tile wasn't visible, then use
            // the tile information.
            return String.format('%s - %s',
                map.getTile(x, y, z).getRepresentation(),
                map.getTile(x, y, z).getDescription());

        } else {
            // If the tile is not explored, show the null tile description.
            return String.format('%s - %s',
                Game.Tile.nullTile.getRepresentation(),
                Game.Tile.nullTile.getDescription());
        }
    }
});

// Define our help screen
Game.Screen.helpScreen = {
    render: function(display) {
        var y = 0;
        display.drawText(0, y++, 'The villagers have been complaining of a terrible stench coming from the cave.');
        display.drawText(0, y++, 'Find the source of this smell and get rid of it!');
        y += 3;
        display.drawText(0, y++, '[w][a][s][d] to move');
        display.drawText(0, y++, '[p] to pick up items');
        display.drawText(0, y++, '[i] to look at inventory');
        display.drawText(0, y++, '[x] to look around you');
        display.drawText(0, y++, '[l] to distribute stat points')
        display.drawText(0, y++, '[?] to show this help screen');
        y += 3;
        text = '--- press any key to continue ---';
        display.drawText(Game.getScreenWidth() / 2 - text.length / 2, y++, text);
    },
    handleInput: function(inputType, inputData) {
        Game.Screen.playScreen.setSubScreen(null);
    }
};