define(['../override', '../utils', '../jquery'], function(override, utils, $) {
    
    "use strict";
    
    return {
        loadFirst: ['filtering'],
        init: function(grid, pluginOptions) {
            override(grid, function($super) {
                return {
                    renderHeaderCell: function() {
                        var h = $super.renderHeaderCell.apply(this, arguments);
                        var handle = $("<div class='pg-resizehandle'></div>");
                        h.append(handle);
                        return h;
                    },

                    init: function() {
                        for (var x = 0, l = this.options.columns.length; x < l; x++) {
                            var column = this.options.columns[x];
                            var width = this.loadSetting(column.key + "_width");
                            if (width !== undefined && width !== null && width !== "") {
                                column.width = width;
                            }
                        }

                        $super.init();
                        var header, key, idx, col, oX, w, offset, resizing=0;

                        function startResize(event) {
                            if($(this).parents('.powergrid')[0] !== grid.container[0]) return;
                            header = event.target.parentNode;
                            key = $(header).attr("data-column-key");
                            idx = utils.findInArray(grid.options.columns, function(col) { return col.key == key; });
                            col = grid.options.columns[idx];
                            
                            if(col.resizable === false) {
                                return;
                            }
                            
                            oX = event.pageX;
                            w = col.width;

                            offset = event.offsetX || event.originalEvent.layerX || 0;

                            if(idx < grid.options.columns.length - grid.options.frozenColumnsRight) { // it's not a right frozen column
                                resizing = 1;
                            } else if(idx >= grid.options.columns.length - grid.options.frozenColumnsRight) {
                                resizing = -1;
                            }
                        }

                        function doResize(event) {
                            if(resizing == 1) {
                                col.width = Math.max(0, event.pageX - oX + w);
                            } else if(resizing == -1) {
                                col.width = Math.max(0, oX - event.pageX + w);
                            } else {
                                return;
                            }
                            requestAnimationFrame(function() {
                                grid.adjustColumnPositions(true);
                                grid.adjustHeights();
                            });
                        }

                        function endResize(event) {
                            if(resizing !== 0) {
                                resizing = 0;
                                grid.saveSetting(col.key + "_width", col.width);
                                event.preventDefault();
                                event.stopImmediatePropagation();
                                requestAnimationFrame(function() {
                                    grid.adjustColumnPositions(false); // final redraw
                                })
                            }
                        }

                        this.container
                            .on("mousedown", ".pg-resizehandle", startResize)
                            .on("mousemove", doResize)
                            .on("mouseup", ":not(.pg-resizehandle)", endResize)
                            .on("click", ".pg-resizehandle", function(event) {
                                event.stopImmediatePropagation();
                                event.preventDefault();
                                event.stopPropagation();
                            });
                    }
                }
            });
        }
    };
    
});