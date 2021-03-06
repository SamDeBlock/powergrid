define(['override', 'jquery', 'promise'], function(override, $, Promise) {
    
    "use strict";
    
    // Adds treegrid functionality to the grid.
    // This works by wrapping the datasource in a TreeGridDataSource whose data can change
    // depending on which rows are collapsed or expanded.
    
    function TreeGridDataSource(delegate, options) {
        this.delegate = delegate;
        this.options = options;
        
        if(delegate.isReady()) {
            this.load();
        }
        
        $(delegate).on("dataloaded", this.load.bind(this));
    }

    TreeGridDataSource.prototype = {
        isReady: function() {
            return this.view !== undefined;
        },
        
        assertReady: function() {
            if(!this.isReady()) {
                throw "Datasource not ready yet";
            }
        },
        
        load: function() {
            this.tree = this.buildTree(this.delegate.getData());
            this.view = this.initView(this.tree, this.options && this.options.initialTreeDepth || 0);
            $(this).trigger("dataloaded");
        },
        
        initView: function(data, initialTreeDepth) {
            var view = [];
            
            function calcDepth(nodes, depth) {
                nodes.forEach(function(x) {
                    x.__depth = depth;
                    x.__expanded = depth < (initialTreeDepth || 0);
                    if(depth <= (initialTreeDepth || 0)) {
                        view.push(x);
                    }
                    if(x.children && x.children.length) {
                        calcDepth(x.children, depth+1);
                    }
                });
            }
            
            calcDepth(data, 0);
            
            return view;
        },
        
        rebuildView: function(data) {
            var view = [];
            
            function build(nodes) {
                for(var x=0,l=nodes.length;x<l;x++) {
                    var r = nodes[x];
                    view.push(r);
                    if(r.__expanded && r.children) {
                        build(r.children);
                    }
                }
            }
            
            build(data, 0);
            
            return view;
        },
        
        buildTree: function(data) {
            var rootNodes = [],
                recordByIdMap = {};
            
            for(var x=0,l=data.length;x<l;x++) {
                var r = data[x];
                recordByIdMap[r.id] = r;
                if(r.parent !== undefined) {
                    var parent = recordByIdMap[r.parent];
                    if(!parent.children) {
                        parent.children = [];   
                    }
                    parent.children.push(r);
                } else {
                    rootNodes.push(r);
                }
            }
            
            return rootNodes;
        },
        
        getRecordById: function(id) {
            return this.delegate.getRecordById(id);
        },
        
        getData: function(start, end) {
            this.assertReady();
            if(start !== undefined || end !== undefined) {
                return this.view.slice(start, end);
            } else {
                return this.view;
            }
        },
        
        recordCount: function() {
            this.assertReady();
            return this.view.length;
        },
        
        toggle: function(rowId) {
            var row = this.getRecordById(rowId);
            if(this.isExpanded(row)) {
                this.collapse(row);
            } else {
                this.expand(row);
            }
        },
        
        expand: function(row) {
            var rowId = row.id,l,x,start;
            
            if(this.isExpanded(row)) {
                // already expanded, don't do anything
                return;
            }

            // find the location of this row in the current view
            for(x=0,l=this.view.length; x<l; x++) {
                if(this.view[x].id == rowId) {
                    start = x;
                    break;
                }
            }
            
            // expand it. then we must insert rows
            row.__expanded = true;
            if(start !== undefined) {
                var rows = this.flattenSubTree(row.children);
                this.view.splice.apply(this.view, [start+1, 0].concat(rows));
                $(this).trigger('rowsadded',{start: start+1, end: start+1 + rows.length});
            }
                        
            $(this).trigger('treetoggled', rowId, start, this.isExpanded(row));
        },
        
        collapse: function(row) {
            var rowId = row.id,x,l,start,end,startDepth;
            
            if(!this.isExpanded(row)) {
                // already expanded, don't do anything
                return;
            }
            
            for(x=0,l=this.view.length; x<l; x++) {
                if(start === undefined && this.view[x].id == rowId) {
                    startDepth = row.__depth;
                    start = x;
                } else if(start !== undefined) {
                    if(this.view[x].__depth <= startDepth) {
                        end = x;
                        break;
                    }
                }
            }

            // collapse it. we must remove some rows from the view.
            row.__expanded = false;
            if(start !== undefined) {
                this.view.splice(start+1, end-start-1);
                $(this).trigger('rowsremoved',{start: start+1, end: end});
            }
                        
            $(this).trigger('treetoggled', rowId, start, this.isExpanded(row));
        },
        
        isExpanded: function(row) {
            return row.__expanded;
        },
        
        expandAll: function(rowId) {
            var ds = this;
            function expandall(row) {
                if(row.children) {
                    row.children.forEach(expandall);
                }
                ds.expand(row);
            }
            
            if(rowId === undefined) {
                this.tree.forEach(expandall);
            } else {
                expandall(this.getRecordById(rowId));
            }
        },

        flattenSubTree: function(nodes) {
            var out = [];
            function f(nodes) {
                for(var x=0,l=nodes.length;x<l;x++) {
                    var node = nodes[x];
                    out.push(node);
                    if(node.children && node.__expanded) {
                        f(nodes[x].children);
                    }
                }
            }
            if(nodes) f(nodes);
            return out;
        },
        
        sort: function(comparator) {
            function sort(arr) {
                arr.sort(comparator);
                for(var x=0,l=arr.length;x<l;x++) {
                    if(arr[x].children) {
                        sort(arr[x].children);
                    }
                }
            }
            
            sort(this.tree);
            this.view = this.rebuildView(this.tree);
        }
    };
    
    return {
        init: function(grid, pluginOptions) {
            var treedepths = [],
                data,
                view;

            override(grid, function($super) {
                var treeDS = new TreeGridDataSource(this.dataSource, pluginOptions);

                return {
                    init: function() {
                        $super.init();

                        this.target.on("click", ".pg-treetoggle", function(event) {
                            var row = $(this).parents(".pg-row").first(),
                                rowId = row.attr("data-row-id");

                            treeDS.toggle(rowId);

                            event.stopPropagation();
                            event.preventDefault();
                        });

                        $(treeDS).on("treetoggled", function(event, rowId, rowIndex, newState) {
                            grid.target.find(".pg-row[data-row-id='" + rowId + "'] .pg-treetoggle").toggleClass("pg-tree-expanded", newState);
                        });
                    },

                    renderCellContent: function(record, rowIdx, column, value) {
                        var content = $super.renderCellContent.apply(this, arguments);
                        if(column.treeColumn) {
                            return $('<div>')
                                .addClass((record.children && record.children.length) ? "pg-treetoggle" : "pg-treeleaf")
                                .addClass('pg-tree-level-' + record.__depth)
                                .toggleClass("pg-tree-expanded", record.__expanded)
                                .add(content);
                        } else {
                            return content;
                        }
                    },

                    dataSource: treeDS
                }
            });
        },
        
        TreeGridDataSource: TreeGridDataSource
    };
    
});