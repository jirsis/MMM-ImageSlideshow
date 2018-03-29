/* global Module */

/* node_helper.js
 * 
 * Magic Mirror
 * Module: MMM-ImageSlideshow
 * 
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 * 
 * Module MMM-ImageSlideshow By Adam Moses http://adammoses.com
 * and extended by Iñaki Reta Sabarrós https://github.com/jirsis
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var FileSystemImageSlideshow = require("fs");
var PathImageSlideshow = require('path');
var OS = require('os');


module.exports = NodeHelper.create({
    start: function() {
        this.moduleConfigs = [];
    },
    
    shuffleArray: function(array) {
      var currentIndex = array.length, temporaryValue, randomIndex;
      while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
      }
      return array;
    },
    
    sortByFilename: function (a, b) {
        aL = a.filename.toLowerCase();
        bL = b.filename.toLowerCase();
        if (aL > bL) 
			return 1;
		else 
			return -1;
    },
    
    checkValidImageFileExtension: function(filename, extensions) {
        var extList = extensions.split(',');
        for (var extIndex = 0; extIndex < extList.length; extIndex++) {
            if (filename.toLowerCase().endsWith(extList[extIndex]))
                return true;
        }
        return false;
    },
    
    gatherImageList: function(config) {
        var self = this;
        var imageList = [];
        var imageListComplete = [];

        if(config.cacheFoundImages) {
            imageListComplete = this.loadFromCache(config.cacheFilename);
        } 
        
        if(imageListComplete.length == 0) {
            imageList = this.searchImages(config);
            imageList = this.tryToJoinAllPaths(config, imageList);
        
            for (var index = 0; index < imageList.length; index++) {
                imageListComplete.push(imageList[index].path + '/' + imageList[index].filename);
            }
            if(config.cacheFoundImages){
                this.persistCache(imageListComplete, config.cacheFilename);
            }
        }
        return imageListComplete;
    },

    loadFromCache: function(cacheFilename){
        var images = [];
        var pathCache = PathImageSlideshow.join(OS.tmpdir(), cacheFilename);
        if(FileSystemImageSlideshow.existsSync(pathCache)){
            images = JSON.parse(FileSystemImageSlideshow.readFileSync(pathCache, 'utf8'));
            console.log('[MMM-ImageSlideshow] images loaded from cache: '+pathCache);
        }
        return images;
    },

    persistCache: function(images, cacheFilename){
        var pathCache = PathImageSlideshow.join(OS.tmpdir(), cacheFilename);
        if(!FileSystemImageSlideshow.existsSync(pathCache)){
            FileSystemImageSlideshow.writeFileSync(pathCache, JSON.stringify(images));
            console.log('[MMM-ImageSlideshow] images cache created: '+pathCache);
        }else{
            console.log('[MMM-ImageSlideshow] images cache founded: '+pathCache);
        }
    },

    tryToJoinAllPaths: function(config, imageList){
        if (config.treatAllPathsAsOne) {
            if (config.randomizeImageOrder){
                imageList = this.shuffleArray(imageList);
            } else {
                imageList = imageList.sort(this.sortByFilename);
            }
        }
        return imageList;
    },

    searchImages: function(config){
        var imageList = [];
        for (var pathIndex = 0; pathIndex < config.imagePaths.length; pathIndex++) {
            var currentPath = config.imagePaths[pathIndex];
            var currentPathImageList = FileSystemImageSlideshow.readdirSync(path = currentPath);
            
            if (currentPathImageList.length > 0) {
                var currentImageList=[];
                if(config.includeRecursive){
                    currentImageList=this.gatherInRecursivePath(config, currentPath);
                }else{
                    currentImageList=this.gatherInPlainPath(config, currentPathImageList, currentPath);
                }

                if (!config.treatAllPathsAsOne) {
                    if (config.randomizeImageOrder){
                        currentImageList = this.shuffleArray(currentImageList);
                    }else{
                        currentImageList = currentImageList.sort(this.sortByFilename);
                    }
                }
                
                imageList = imageList.concat(currentImageList);
            }
        }
        return imageList;
    },

    gatherInRecursivePath: function(config, currentPath){
        var currentImageList = [];
        currentImageList = this.walkSync(currentPath, [], config);
        return currentImageList;
    },

    walkSync: function(dir, filelist, config) {
        var self = this;
        files = FileSystemImageSlideshow.readdirSync(dir);
        filelist = filelist || [];
        files.forEach(function(file) {
            if (FileSystemImageSlideshow.statSync(PathImageSlideshow.join(dir, file)).isDirectory()) {
                filelist = self.walkSync(PathImageSlideshow.join(dir, file), filelist, config);
            } else if(self.isFiltered(file, config.patternToInclude)){
                filelist.push({
                    path: dir,
                    filename: file
                });
            }
        });
        return filelist;
    },

    isFiltered: function(name, pattern){
        return name[0] !== '.' &&
               name.match(new RegExp(pattern));
    },

    gatherInPlainPath: function(config, currentPathImageList, currentPath){
        var currentImageList = [];
        
        // for each file
        for (var imageIndex = 0; imageIndex < currentPathImageList.length; imageIndex++) {
            
            // seperate into path and filename
            var currentImage = {path: currentPath, filename: currentPathImageList[imageIndex]};
            // check if file has a valid image file extension
            var isValidImageFileExtension = this.checkValidImageFileExtension(
                        currentImage.filename, 
                        config.validImageFileExtensions);
            
            //  if file is valid, add it to the list
            if (isValidImageFileExtension){
                currentImageList.push(currentImage);
            }
        }
        return currentImageList;
    },

    // subclass socketNotificationReceived, received notification from module
    socketNotificationReceived: function(notification, payload) {
        if (notification === "IMAGESLIDESHOW_REGISTER_CONFIG") {
            // add the current config to an array of all configs used by the helper
            this.moduleConfigs.push(payload);
            // this to self
            var self = this;
            // get the image list
            var imageList = this.gatherImageList(payload);
            // build the return payload
            var returnPayload = { identifier: payload.identifier, imageList: imageList };
            // send the image list back
            self.sendSocketNotification('IMAGESLIDESHOW_FILELIST', returnPayload );
        }
    },     


});

//------------ end -------------
