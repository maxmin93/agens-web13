// Title: Agens Graph Utilities using Cytoscape
// Right: Bitnine.net
// Author: Byeong-Guk Min <maxmin93@gmail.com>

// Self-Executing Anonymous Func: Part 2 (Public &amp; Private)
// ** 참고
// https://stackoverflow.com/a/5947280/6811653

// Structure
// ----------------------
//  agens
//    .cy
//    .graph
//      .defaultSetting, .defaultStyle, .demoData[], .layoutTypes[]
//      .ready(), .loadData(), saveFile(), saveImage()
//    .$api
//      .view
//      .unre
//

(function( agens, undefined ) {

  // sub namespaces : graph, api, dialog
  agens.cy = null;
  agens.graph = agens.graph || {};

  /////////////////////////////////////////////////////////
  //  NAMESPACE: agens.caches
  /////////////////////////////////////////////////////////

  agens.caches = {
    nodePosition: new WeakMap(),
    nodeLabel: new WeakMap(),
    nodeColor: new WeakMap(),
    nodeWidth: new WeakMap(),
    edgeLabel: new WeakMap(),
    edgeColor: new WeakMap(),
    edgeWidth: new WeakMap(),
    reset: function(option){
      if( option === undefined || option === 'nodePosition' ) this.nodePosition = new WeakMap();
      if( option === undefined || option === 'nodeLabel' ) this.nodeLabel = new WeakMap();
      if( option === undefined || option === 'nodeColor' ) this.nodeColor = new WeakMap();
      if( option === undefined || option === 'nodeWidth' ) this.nodeWidth = new WeakMap();
      if( option === undefined || option === 'edgeLabel' ) this.edgeLabel = new WeakMap();
      if( option === undefined || option === 'edgeColor' ) this.edgeColor = new WeakMap();
      if( option === undefined || option === 'edgeWidth' ) this.edgeWidth = new WeakMap();
    },
    rollback: function(option){
      if( option === undefined || option === 'nodePosition' ){
        agens.cy.nodes().map( ele => {
          if( agens.caches.nodePosition.has(ele) ){
            ele.position( agens.caches.nodePosition.get(ele) );
          } 
        });
        agens.cy.fit( agens.cy.elements(), 30);
      }
      if( option === undefined || option === 'nodeLabel' ){
        agens.cy.nodes().map( ele => {
          if( agens.caches.nodeLabel.has(ele) )
            ele.style('label', agens.graph.defaultSetting.hideNodeTitle 
                        ? '' : agens.caches.nodeLabel.get(ele));
        });
      }
      if( option === undefined || option === 'nodeColor' ){
        agens.cy.nodes().map( ele => {
          if( agens.caches.nodeColor.has(ele) )
            ele.style('background-color', agens.caches.nodeColor.get(ele));
        });
      }
      if( option === undefined || option === 'nodeWidth' ){
        agens.cy.nodes().map( ele => {
          if( agens.caches.nodeWidth.has(ele) )
            ele.style('width', agens.caches.nodeWidth.get(ele));
            ele.style('height', agens.caches.nodeWidth.get(ele));
        });
      }
      if( option === undefined || option === 'edgeLabel' ){
        agens.cy.edges().map( ele => {
          if( agens.caches.edgeLabel.has(ele) )
            ele.style('label', agens.graph.defaultSetting.hideEdgeTitle
                        ? '' : agens.caches.edgeLabel.get(ele) );
        });
      }
      if( option === undefined || option === 'edgeColor' ){
        agens.cy.edges().map( ele => {
          if( agens.caches.edgeColor.has(ele) )
            ele.style('line-color', agens.caches.edgeColor.get(ele) );
            ele.style('source-arrow-color', agens.caches.edgeColor.get(ele) );
            ele.style('target-arrow-color', agens.caches.edgeColor.get(ele) );            
        });
      }
      if( option === undefined || option === 'edgeWidth' ){
        agens.cy.edges().map( ele => {
          if( agens.caches.edgeWidth.has(ele) )
            ele.style('width', agens.caches.edgeWidth.get(ele) );
        });
      }
    }
  };

  /////////////////////////////////////////////////////////
  //  NAMESPACE: agens.styles
  /////////////////////////////////////////////////////////

  agens.styles = {
    nodeLabel: function(e){
      if( e.scratch('_style') && e.scratch('_style').title )
        return e.data('props').hasOwnProperty(e.scratch('_style').title) ? e.data('props')[e.scratch('_style').title] : '';
      return e.data('name');
    },
    nodeColor: function(e){
      if( e.scratch('_style') && e.scratch('_style').color ) 
        return e.scratch('_style').color;
      return '#68bdf6';
    },
    nodeWidth: function(e){
      if( e.scratch('_style') && e.scratch('_style').width ) 
        return e.scratch('_style').width;
      return '55px';
    },
    edgeLabel: function(e){
      if( e.scratch('_style') && e.scratch('_style').title )
        return e.data('props').hasOwnProperty(e.scratch('_style').title) ? e.data('props')[e.scratch('_style').title] : '';
      return e.data('name');
    },
    edgeColor: function(e){
      if( e.scratch('_style') && e.scratch('_style').color ) 
        return e.scratch('_style').color;
      return '#a5abb6';
    },
    edgeWidth: function(e){
      if( e.scratch('_style') && e.scratch('_style').width ) 
        return e.scratch('_style').width;
      return '2px';
    }
  };

  // Public Property : defaultStyle
  agens.graph.stylelist = {

    ///////////////////////////////////////////////////////
    // DARK theme
    //
    //  ** NODE background color
    // 'background-color': function(e){ return ( e.data('$$color') === undefined ) ? '#83878d' : e.data('$$color'); },
    //  ** EDGE line color
    // 'line-color': function(e){ return ( e.data('$$color') === undefined ) ? '#c8c8c8' : e.data('$$color'); },
    //
    ///////////////////////////////////////////////////////
    "dark" : [
      {
        selector: 'core',
        css: {
          "selection-box-color": "#11bf1c",
          "selection-box-opacity": 0.25,
          "selection-box-border-color": "#aaa",
          "selection-box-border-width": 1,
          // "panning-cursor": "grabbing",
        }}, {
        selector: 'node',
        css: {
          'label': function(e){
              if( !agens.caches.nodeLabel.has(e) ) 
                agens.caches.nodeLabel.set(e, agens.styles.nodeLabel(e));
              if( !_.isNil( e._private.cy.scratch('_config').hideNodeTitle)
                && e._private.cy.scratch('_config').hideNodeTitle ) return '';
              return agens.caches.nodeLabel.get(e);
            },

          'text-wrap':'wrap',
          'text-max-width':'75px',
          'text-halign': 'center',    // text-halign: left, center, right
          'text-valign': 'center',       // text-valign: top, center, bottom
          'color': 'white',
          'font-weight': 400,
          'font-size': 12,
          'text-opacity': 1,
          // 'background-color': '#68bdf6',
          'background-color': function(e){
            if( !agens.caches.nodeColor.has(e) ) 
              agens.caches.nodeColor.set(e, agens.styles.nodeColor(e));
            return agens.caches.nodeColor.get(e);
          },

          // 'shape': 'eclipse',
          'width': function(e){
            if( !agens.caches.nodeWidth.has(e) ) 
              agens.caches.nodeWidth.set(e, agens.styles.nodeWidth(e));
            return agens.caches.nodeWidth.get(e);
          },
          'height': function(e){
            if( !agens.caches.nodeWidth.has(e) ) 
              agens.caches.nodeWidth.set(e, agens.styles.nodeWidth(e));
            return agens.caches.nodeWidth.get(e);
          },

          'border-width':'3',
          'border-color':'#5fa9dc'
        }},{
          selector: 'node:selected',                /// 선택한 노드의 변화 (.highlighted로 인해 선택된 노드를 강조하고자 하려면 border값으로 변화를 줘야함)
          css: {
            'background-color': 'white',
            'color':'#68bdf6',
            'target-arrow-color': '#a5abb6',
            'source-arrow-color': '#a5abb6',
            'line-color': '#a5abb6',
            'border-style':'dashed',
            'border-color': '#68bdf6',
            'border-width':'3',
            'color':'#68bdf6'
          }}, {
        selector: 'node:locked',
        css: {
          'background-color': '#d64937',
          'text-outline-color': '#d64937',
          'color':'white',
          'border-color': '#d64937',
          'border-width': 3,
          'opacity': 1
         }}, {
          selector: 'node.expand',                /// 기존과 다른 엣지버전의 변화
          css: {
            'opacity': 0.6,
            'color':'black',
            'background-color': 'darkorange',
            'width': '40px',
            'height': '40px',
            'border-color':'orange',
            'border-width': 2,
          }}, {
        selector: 'edge',
        css: {
          'label':function(e){
            if( !agens.caches.edgeLabel.has(e) ) 
              agens.caches.edgeLabel.set(e, agens.styles.edgeLabel(e));
            if( !_.isNil(e._private.cy.scratch('_config').hideEdgeTitle)
              && e._private.cy.scratch('_config').hideEdgeTitle ) return '';
            return agens.caches.edgeLabel.get(e);
          },

          'text-rotation':'autorotate',
          'text-margin-y': -12,
          'color': '#383838',
          'opacity': 1,
  //        'text-outline-width': 2,
  //        'text-outline-color': '#797979',
          // 'line-color': '#a5abb6',
          'line-color': function(e){
            if( !agens.caches.edgeColor.has(e) ) 
              agens.caches.edgeColor.set(e, agens.styles.edgeColor(e));
            return agens.caches.edgeColor.get(e);
          },

          'line-style': 'solid',            // line-style: solid, dotted, dashed
          'width': function(e){
            if( !agens.caches.edgeWidth.has(e) ) 
              agens.caches.edgeWidth.set(e, agens.styles.edgeWidth(e));
            return agens.caches.edgeWidth.get(e);
          },

          'curve-style': 'bezier',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': function(e){
            if( !agens.caches.edgeColor.has(e) ) 
              agens.caches.edgeColor.set(e, agens.styles.edgeColor(e));
            return agens.caches.edgeColor.get(e);
          },
          'source-arrow-shape': 'none',
          'source-arrow-color': function(e){
            if( !agens.caches.edgeColor.has(e) ) 
              agens.caches.edgeColor.set(e, agens.styles.edgeColor(e));
            return agens.caches.edgeColor.get(e);
          },
          'font-size': 12
        }}, {
        selector: 'edge:selected',             /// 엣지만 클릭했을 경우 변화
        css: {
          'background-color': '#ffffff',
          'target-arrow-color': '#483d41',
          'source-arrow-color': '#483d41',
          'line-color': '#483d41',

          'width': 10,
          'opacity': 1,
          'color': '#483d41',
          'text-margin-y': -15,
          'text-outline-width': 2,
          'text-outline-color': 'white',
        }}, {
        selector: 'edge:locked',              /// 엣지를 잠궜을 때 변화
        css: {
          // 'width': 4,
          'opacity': 1,
          'line-color': '#433f40',
          'target-arrow-color': '#433f40',
          'source-arrow-color': '#433f40'
        }}, {
        selector: 'edge.expand',             /// 기존과 다른 엣지버전의 변화
        css: {
          // 'width': 3,
          'border-style':'double',
          'opacity': 0.6,
          'line-color': 'orange',
          'target-arrow-color': 'orange',
          'source-arrow-color': 'orange',
        }}, {
        selector: 'node.highlighted',      // 노드 클릭시 노드 및 엣지 변화(연결된 노드도 같이 변화됨)
        css: {
          'background-color': '#fff',
          'width':'65px',
          'height':'65px',
          'color':'#5fa9dc',
          'target-arrow-color': '#a5abb6',
          'source-arrow-color': '#a5abb6',
          'line-color': '#a5abb6',
          'border-style':'solid',
          'border-color': '#5fa9dc',
          'border-width': 4,
          'transition-property': 'background-color, line-color, target-arrow-color',
          'transition-duration': '0.2s',

        }},{
        selector: 'edge.highlighted',
        css: {
          'width': 12,
          'opacity': 1,
          'color': '#483d41',
          'text-outline-width': 0,
          'line-style':'dashed',
          'line-color': '#83878d',
          'target-arrow-color': '#83878d',
          'source-arrow-color': '#83878d',
        }},{
        selector: '.traveled',
        css: {
          'background-color': '#11bf1c',
          'line-color': '#11bf1c',
          'target-arrow-color': 'black',
          'transition-property': 'background-color, line-color, target-arrow-color',
          'transition-duration': '0.2s'
        }},{
        selector: '.edgehandles-hover',   /// 엣지 드래그한 후 선택한 노드의 변화
        css: {
          'background-color': '#d80001'
        }},{
        selector: '.edgehandles-source',    /// 선택된 노드의 드래그시 변화
        css: {
          'border-width': 10,
          'border-color': '#d80001',
          'background-color':'#d80001',
          'text-outline-color': '#d80001',
        }},{
        selector: '.edgehandles-target',   /// 엣지연결할 타겟의 노드변화
        css: {
          // 'border-width': 2,
          'border-color': 'white',
          'text-outline-color': '#d80001',
        }},{
        selector: '.edgehandles-preview, .edgehandles-ghost-edge', /// 선택된 노드에 연결될 엣지의 예상변화
        css: {
          'line-color': '#d80001',
          'target-arrow-color': '#d80001',
          'source-arrow-color': '#d80001',
        }
      }
    ]
  };

  // Public Property : Layout Options
  agens.graph.layoutTypes = {
    'grid': {
      name: 'grid',
      fit: true,                          // whether to fit the viewport to the graph
      padding: 50,                        // padding used on fit
      boundingBox: undefined,             // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
      avoidOverlap: true,                 // prevents node overlap, may overflow boundingBox if not enough space
      avoidOverlapPadding: 10,            // extra spacing around nodes when avoidOverlap: true
      nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
      spacingFactor: undefined,           // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
      condense: false,                    // uses all available space on false, uses minimal space on true
      rows: undefined,                    // force num of rows in the grid
      cols: undefined,                    // force num of columns in the grid
      position: function( node ){},       // returns { row, col } for element
      sort: undefined,                    // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
      animate: false,                     // whether to transition the node positions
      animationDuration: 500,             // duration of animation in ms if enabled
      animationEasing: undefined,         // easing of animation if enabled
    },
    'random': {
      name: 'random',
      fit: true,                          // whether to fit to viewport
      padding: 50,                        // fit padding
      boundingBox: undefined,             // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
      animate: false,                     // whether to transition the node positions
      animationDuration: 500,             // duration of animation in ms if enabled
      animationEasing: undefined,         // easing of animation if enabled
    },
    'breadthfirst': {
      name: 'breadthfirst',
      fit: true,                          // whether to fit the viewport to the graph
      directed: false,                    // whether the tree is directed downwards (or edges can point in any direction if false)
      padding: 50,                        // padding on fit
      circle: false,                      // put depths in concentric circles if true, put depths top down if false
      spacingFactor: 1.75,                // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
      boundingBox: undefined,             // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
      avoidOverlap: true,                 // prevents node overlap, may overflow boundingBox if not enough space
      nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
      roots: undefined,                   // the roots of the trees
      maximalAdjustments: 0,              // how many times to try to position the nodes in a maximal way (i.e. no backtracking)
      animate: false,                     // whether to transition the node positions
      animationDuration: 500,             // duration of animation in ms if enabled
      animationEasing: undefined,         // easing of animation if enabled
    },
    'circle': {
      name: 'circle',
      fit: true,                          // whether to fit the viewport to the graph
      padding: 50,                        // the padding on fit
      boundingBox: undefined,             // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
      avoidOverlap: true,                 // prevents node overlap, may overflow boundingBox and radius if not enough space
      nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
      spacingFactor: undefined,           // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
      radius: undefined,                  // the radius of the circle
      startAngle: 3 / 2 * Math.PI,        // where nodes start in radians
      sweep: undefined,                   // how many radians should be between the first and last node (defaults to full circle)
      clockwise: true,                    // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
      sort: undefined,                    // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
      animate: false,                     // whether to transition the node positions
      animationDuration: 500,             // duration of animation in ms if enabled
      animationEasing: undefined,         // easing of animation if enabled
    },
    'concentric': {
      name: 'concentric',
      fit: true,                          // whether to fit the viewport to the graph
      padding: 50,                        // the padding on fit
      startAngle: 3 / 2 * Math.PI,        // where nodes start in radians
      sweep: undefined,                   // how many radians should be between the first and last node (defaults to full circle)
      clockwise: true,                    // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
      equidistant: false,                 // whether levels have an equal radial distance betwen them, may cause bounding box overflow
      minNodeSpacing: 10,                 // min spacing between outside of nodes (used for radius adjustment)
      boundingBox: undefined,             // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
      avoidOverlap: true,                 // prevents node overlap, may overflow boundingBox if not enough space
      nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
      height: undefined,                  // height of layout area (overrides container height)
      width: undefined,                   // width of layout area (overrides container width)
      spacingFactor: undefined,           // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
      concentric: function( node ){ return node.degree(); },  // returns numeric value for each node, placing higher nodes in levels towards the centre
      levelWidth: function( nodes ){ return nodes.maxDegree() / 4; }, // the variation of concentric values in each level
      animate: false,                     // whether to transition the node positions
      animationDuration: 500,             // duration of animation in ms if enabled
      animationEasing: undefined,         // easing of animation if enabled
    },      
    // ** NOTE: 제외시킴 (2018-01-19)
    // ** 애니메이션이 너무 오래 걸려서 제외 (애니메이션 꺼도 오래걸림)
    'cola': {
      name: 'cola',
      animate: false,                      // whether to show the layout as it's running
      refresh: 1,                         // number of ticks per frame; higher is faster but more jerky
      maxSimulationTime: 1500,            // max length in ms to run the layout
      ungrabifyWhileSimulating: false,    // so you can't drag nodes during layout
      fit: true,                          // on every layout reposition of nodes, fit the viewport
      padding: 50,                        // padding around the simulation
      boundingBox: undefined,             // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
      // positioning options
      randomize: true,                    // use random node positions at beginning of layout
      avoidOverlap: true,                 // if true, prevents overlap of node bounding boxes
      handleDisconnected: true,           // if true, avoids disconnected components from overlapping
      nodeSpacing: function (node) { return 10; }, // extra spacing around nodes
      flow: undefined,                    // use DAG/tree flow layout if specified, e.g. { axis: 'y', minSeparation: 30 }
      alignment: undefined,               // relative alignment constraints on nodes, e.g. function( node ){ return { x: 0, y: 1 } }
      // different methods of specifying edge length
      // each can be a constant numerical value or a function like `function( edge ){ return 2; }`
      edgeLength: undefined,              // sets edge length directly in simulation
      edgeSymDiffLength: undefined,       // symmetric diff edge length in simulation
      edgeJaccardLength: undefined,       // jaccard edge length in simulation
      // iterations of cola algorithm; uses default values on undefined
      unconstrIter: undefined,            // unconstrained initial layout iterations
      userConstIter: undefined,           // initial layout iterations with user-specified constraints
      allConstIter: undefined,            // initial layout iterations with all constraints including non-overlap
      // infinite layout options
      infinite: false                     // overrides all other options for a forces-all-the-time mode
    },
    'cose': {
      name: 'cose',
      animate: true,                      // Whether to animate while running the layout
      // The layout animates only after this many milliseconds
      animationThreshold: 250,            // (prevents flashing on fast runs)
      // Number of iterations between consecutive screen positions update
      refresh: 20,                        // (0 -> only updated on the end)
      fit: true,                          // Whether to fit the network view after when done
      padding: 50,                        // Padding on fit
      boundingBox: undefined,             // Constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
      nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
      randomize: true,                    // Randomize the initial positions of the nodes (true) or use existing positions (false)
      componentSpacing: 50,               // Extra spacing between components in non-compound graphs
      nodeRepulsion: function( node ){ return 400000; },  // Node repulsion (non overlapping) multiplier
      nodeOverlap: 10,                    // Node repulsion (overlapping) multiplier
      idealEdgeLength: function( edge ){ return 10; },    // Ideal edge (non nested) length
      edgeElasticity: function( edge ){ return 100; },    // Divisor to compute edge forces
      nestingFactor: 5,                   // Nesting factor (multiplier) to compute ideal edge length for nested edges
      gravity: 80,                        // Gravity force (constant)
      numIter: 800,                       // Maximum number of iterations to perform
      initialTemp: 200,                   // Initial temperature (maximum node displacement)
      coolingFactor: 0.95,                // Cooling factor (how the temperature is reduced between consecutive iterations
      minTemp: 1.0,                       // Lower temperature threshold (below this point the layout will end)
      weaver: false                       // Pass a reference to weaver to use threads for calculations
    },
    'cose2': {
      name: 'cose-bilkent',
      nodeDimensionsIncludeLabels: false, // Whether to include labels in node dimensions. Useful for avoiding label overlap
      refresh: 30,                        // number of ticks per frame; higher is faster but more jerky
      fit: true,                          // Whether to fit the network view after when done
      padding: 50,                        // Padding on fit
      randomize: true,                    // Whether to enable incremental mode
      nodeRepulsion: 4500,                // Node repulsion (non overlapping) multiplier
      idealEdgeLength: 50,                // Ideal (intra-graph) edge length
      edgeElasticity: 0.45,               // Divisor to compute edge forces
      nestingFactor: 0.1,                 // Nesting factor (multiplier) to compute ideal edge length for inter-graph edges
      gravity: 0.25,                      // Gravity force (constant)
      numIter: 2500,                      // Maximum number of iterations to perform
      tile: true,                         // Whether to tile disconnected nodes
      animate: 'end',                     // Type of layout animation. The option set is {'during', 'end', false}
      tilingPaddingVertical: 10,          // Amount of vertical space to put between degree zero nodes during tiling (can also be a function)
      tilingPaddingHorizontal: 10,        // Amount of horizontal space to put between degree zero nodes during tiling (can also be a function)
      gravityRangeCompound: 1.5,          // Gravity range (constant) for compounds
      gravityCompound: 1.0,               // Gravity force (constant) for compounds
      gravityRange: 3.8,                  // Gravity range (constant)
      initialEnergyOnIncremental: 0.5     // Initial cooling factor for incremental layout
    },
    'dagre': {
      name: 'dagre',
      fit: true,                          // whether to fit to viewport
      padding: 50,                        // fit padding
      spacingFactor: undefined,           // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
      animate: true,                      // whether to transition the node positions
      animationDuration: 500,             // duration of animation in ms if enabled
      animationEasing: undefined,         // easing of animation if enabled
      boundingBox: undefined,             // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
      // dagre algo options, uses default value on undefined
      nodeSep: undefined,                 // the separation between adjacent nodes in the same rank
      edgeSep: undefined,                 // the separation between adjacent edges in the same rank
      rankSep: undefined,                 // the separation between adjacent nodes in the same rank
      rankDir: undefined,                 // 'TB' for top to bottom flow, 'LR' for left to right
      minLen: function( edge ){ return 1; },      // number of ranks to keep between the source and target of the edge
      edgeWeight: function( edge ){ return 1; },  // higher weight edges are generally made shorter and straighter than lower weight edges
    },
    'arbor': {
      name: 'arbor',
      animate: true,                      // whether to show the layout as it's running
      maxSimulationTime: 1500,            // max length in ms to run the layout
      fit: true,                          // on every layout reposition of nodes, fit the viewport
      padding: 50,                        // padding around the simulation
      boundingBox: undefined,             // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
      ungrabifyWhileSimulating: false,    // so you can't drag nodes during layout
      // forces used by arbor (use arbor default on undefined)
      repulsion: undefined,
      stiffness: undefined,
      friction: undefined,
      gravity: true,
      fps: undefined,
      precision: undefined,
      // static numbers or functions that dynamically return what these
      // values should be for each element
      // e.g. nodeMass: function(n){ return n.data('weight') }
      nodeMass: undefined,
      edgeLength: undefined,
      stepSize: 0.1,                      // smoothing of arbor bounding box
      // function that returns true if the system is stable to indicate
      // that the layout can be stopped
      stableEnergy: function (energy) {
          var e = energy;
          return (e.max <= 0.5) || (e.mean <= 0.3);
      },
      // infinite layout options
      infinite: false                     // overrides all other options for a forces-all-the-time mode
    }
  };
      
  // Public Property : defaultSetting
  // ==> cy 인스턴스 생성 후 cy.scratch('_config')로 저장됨
  //     : 스타일 함수 등에서는 e._private.cy.scratch('_config') 로 액세스 가능
  agens.graph.defaultSetting = {
    elements: { nodes: [], edges: [] },
    style: undefined,       // agens.graph.stylelist['dark'],
    layout: { name: 'euler',
        fit: true, padding: 30, boundingBox: undefined, 
        nodeDimensionsIncludeLabels: true, randomize: false,
        animate: 'end', animationDuration: 800, maxSimulationTime: 2800,
        ready: function(){}, stop: function(){}
      },

    // initial viewport state:
    zoom: 1,
    pan: { x: 0, y: 0 },
    // interaction options:
    minZoom: 1e-2,
    maxZoom: 1e1,
    zoomingEnabled: true,
    userZoomingEnabled: true,
    panningEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: true,
    selectionType: 'single',    // 'additive',
    touchTapThreshold: 8,
    desktopTapThreshold: 4,
    autolock: false,
    autoungrabify: false,
    autounselectify: false,
    // rendering options:
    headless: false,
    styleEnabled: true,
    hideEdgesOnViewport: true,    // false
    hideLabelsOnViewport: true,   // false
    textureOnViewport: false,     // false
    motionBlur: false,
    motionBlurOpacity: 0.2,
    wheelSensitivity: 0.2,
    pixelRatio: 'auto',

    // user-defined options:

    /////////////////////////////////////////////////////////
    // NAMESPACE: agens.cy
    /////////////////////////////////////////////////////////

    // ready function
    ready: function(e){
      agens.cy = e.cy;
      agens.graph.ready(e.cy);
    },
  };

  // 사용자 설정
  // ==> graphFactory(target, options) 의 options 입력으로 사용됨
  agens.graph.customSetting = {
    container: document.getElementById('agens-graph'),
    selectionType: 'single',    // 'single' or 'multiple'
    boxSelectionEnabled: false, // if single then false, else true
    useCxtmenu: true,           // whether to use Context menu or not
    hideNodeTitle: true,        // hide nodes' title
    hideEdgeTitle: true,        // hide edges' title
  };

  // Public Function : graphFactory()
  agens.graph.graphFactory = function(target, options){
    let customSetting = _.clone( agens.graph.defaultSetting );

    customSetting.container = target;
    if( options === undefined ){
      customSetting = _.merge( customSetting, agens.graph.customSetting );
    }
    else{
      // selectionType 이 single이면 multiSelection 못하게
      if( !_.isNil( options['selectionType'] )){
        customSetting['selectionType'] = options['selectionType'];
        customSetting['boxSelectionEnabled'] = (options['selectionType'] !== 'single') ? true : false;
      }
      // meta 그래프의 경우 CxtMenu 기능이 필요 없음
      if( !_.isNil( options['useCxtmenu'] )) customSetting['useCxtmenu'] = options['useCxtmenu'];
      // data 그래프의 경우 성능향상을 위해 
      if( !_.isNil( options['hideNodeTitle'] )) customSetting['hideNodeTitle'] = options['hideNodeTitle'];
      if( !_.isNil( options['hideEdgeTitle'] )) customSetting['hideEdgeTitle'] = options['hideEdgeTitle'];
    }

    let cy = cytoscape(customSetting);
    cy.scratch('_config', customSetting);

    return cy;
  };

  // Public Function : ready()
  // 1) qtip
  // 2) edgehandles
  // 3) panzoom
  agens.graph.ready = function(cy){
    if( cy === undefined || cy === null ) cy = agens.cy;
    cy.$api = {};

    cy.$api.panzoom = cy.panzoom({
      zoomFactor: 0.05, // zoom factor per zoom tick
      zoomDelay: 45, // how many ms between zoom ticks
      minZoom: 0.01, // min zoom level
      maxZoom: 10, // max zoom level
      fitPadding: 50, // padding when fitting
      panSpeed: 10, // how many ms in between pan ticks
      panDistance: 10, // max pan distance per tick
      panDragAreaSize: 75, // the length of the pan drag box in which the vector for panning is calculated (bigger = finer control of pan speed and direction)
      panMinPercentSpeed: 0.25, // the slowest speed we can pan by (as a percent of panSpeed)
      panInactiveArea: 3, // radius of inactive area in pan drag box
      panIndicatorMinOpacity: 0.5, // min opacity of pan indicator (the draggable nib); scales from this to 1.0
      autodisableForMobile: true, // disable the panzoom completely for mobile (since we don't really need it with gestures like pinch to zoom)
      // additional
      zoomOnly: false, // a minimal version of the ui only with zooming (useful on systems with bad mousewheel resolution)
      fitSelector: undefined, // selector of elements to fit
      animateOnFit: function(){ // whether to animate on fit
        return false;
      },
      // icon class names
      sliderHandleIcon: 'fa fa-minus',
      zoomInIcon: 'fa fa-plus',
      zoomOutIcon: 'fa fa-minus',
      resetIcon: 'fa fa-expand'
    });
    // mouse wheel disable
    cy.$api.panzoom.userZoomingEnabled( false );

    // ==========================================
    // ==  cy events 등록
    // ==========================================

    // 마우스가 찍힌 위치를 저장 (해당 위치에 노드 등을 생성할 때 사용)
    cy.on('cxttapstart', function(e){
      cy.cyPosition = e.cyPosition;
    });

    cy.on('tap', function(e){
      // 바탕화면 탭 이벤트
      if( e.target === cy ){
        // cancel selected and highlights
        if( cy.$api.view !== undefined ) cy.$api.view.removeHighlights();
        cy.$(':selected').unselect();
        cy.pivotNode = null;

        // mapping user Functions
        if( !!window['angularComponentRef'] && !!window['angularComponentRef'].cyCanvasCallback )
          (window['angularComponentRef'].cyCanvasCallback)();
        if( !!window['metaGraphComponentRef'] && !!window['metaGraphComponentRef'].cyCanvasCallback )
          (window['metaGraphComponentRef'].cyCanvasCallback)();
        if( !!window['dataGraphComponentRef'] && !!window['dataGraphComponentRef'].cyCanvasCallback )
          (window['dataGraphComponentRef'].cyCanvasCallback)();
        if( !!window['statGraphComponentRef'] && !!window['statGraphComponentRef'].cyCanvasCallback )
          (window['statGraphComponentRef'].cyCanvasCallback)();
      }

      // 노드 또는 에지에 대한 클릭 이벤트
      else{
        if( !e.target.isNode() && !e.target.isEdge() ) return;
        
        // mapping user Functions
        if( !!window['angularComponentRef'] && !!window['angularComponentRef'].cyElemCallback )
          (window['angularComponentRef'].cyElemCallback)(e.target);
        if( !!window['metaGraphComponentRef'] && !!window['metaGraphComponentRef'].cyElemCallback )
          (window['metaGraphComponentRef'].cyElemCallback)(e.target);
        if( !!window['dataGraphComponentRef'] && !!window['dataGraphComponentRef'].cyElemCallback )
          (window['dataGraphComponentRef'].cyElemCallback)(e.target);
        if( !!window['statGraphComponentRef'] && !!window['statGraphComponentRef'].cyElemCallback )
          (window['statGraphComponentRef'].cyElemCallback)(e.target);

        // if NODE
        if( e.target.isNode() ){
          cy.pivotNode = e.target;
          // mapping user Functions
          if( !!window['angularComponentRef'] && !!window['angularComponentRef'].cyNodeCallback )
            (window['angularComponentRef'].cyNodeCallback)(e.target);
          if( !!window['metaGraphComponentRef'] && !!window['metaGraphComponentRef'].cyNodeCallback )
            (window['metaGraphComponentRef'].cyNodeCallback)(e.target);
          if( !!window['dataGraphComponentRef'] && !!window['dataGraphComponentRef'].cyNodeCallback )
            (window['dataGraphComponentRef'].cyNodeCallback)(e.target);
          if( !!window['statGraphComponentRef'] && !!window['statGraphComponentRef'].cyNodeCallback )
            (window['statGraphComponentRef'].cyNodeCallback)(e.target);
        }

        // if EDGE
        if( e.target.isEdge() ){
          // mapping user Functions
          if( !!window['angularComponentRef'] && !!window['angularComponentRef'].cyEdgeCallback )
            (window['angularComponentRef'].cyEdgeCallback)(e.target);
          if( !!window['metaGraphComponentRef'] && !!window['metaGraphComponentRef'].cyEdgeCallback )
            (window['metaGraphComponentRef'].cyEdgeCallback)(e.target);
          if( !!window['dataGraphComponentRef'] && !!window['dataGraphComponentRef'].cyEdgeCallback )
            (window['dataGraphComponentRef'].cyEdgeCallback)(e.target);
          if( !!window['statGraphComponentRef'] && !!window['statGraphComponentRef'].cyEdgeCallback )
            (window['statGraphComponentRef'].cyEdgeCallback)(e.target);
        }
      }

    });

    // ** NOTE: mouseover 이벤트는 부하가 심하고 작동도 하지 않음!
    // cy.on('mouseover', 'node', function(e){
    // });

    cy.cyQtipMenuCallback = function( id, targetName ){
      let targets = cy.getElementById(id);
      if( targets.size() == 0 ) return;

      // mapping user Functions
      if( !!window['angularComponentRef'] && !!window['angularComponentRef'].cyQtipMenuCallback )
        (window['angularComponentRef'].cyQtipMenuCallback)(targets[0], targetName);
      if( !!window['metaGraphComponentRef'] && !!window['metaGraphComponentRef'].cyQtipMenuCallback )
        (window['metaGraphComponentRef'].cyQtipMenuCallback)(targets[0], targetName);
      if( !!window['dataGraphComponentRef'] && !!window['dataGraphComponentRef'].cyQtipMenuCallback )
        (window['dataGraphComponentRef'].cyQtipMenuCallback)(targets[0], targetName);
      if( !!window['statGraphComponentRef'] && !!window['statGraphComponentRef'].cyQtipMenuCallback )
        (window['statGraphComponentRef'].cyQtipMenuCallback)(targets[0], targetName);
    };

    // ==========================================
    // ==  cy utilities 등록
    // ==========================================

    cy.$api.findById = function(id){
      let eles = cy.elements().getElementById(id);
      return eles.nonempty() ? result[0] : undefined;
    };

    // layouts = { *'euler', 'klay', 'dagre', 'cose-bilkent', 'concentric" }
    cy.$api.changeLayout = function(layout='euler', selected=false){
      console.log( 'cy.$api.changeLayout:', layout);
      let elements = cy.elements(':visible');
      let selectedElements = cy.elements(':selected');
      if( selected && selectedElements.length > 1 ) elements = selectedElements;
        
      let layoutOption = {
        name: layout,
        fit: true, padding: 30, boundingBox: undefined, 
        nodeDimensionsIncludeLabels: true, randomize: false,
        animate: 'end', animationDuration: 800, maxSimulationTime: 2800,
        ready: function(){}, stop: function(){}
      };
  
      // adjust layout
      let layoutHandler = elements.layout(layoutOption);
      // layoutHandler.on('layoutstart', function(){
      //   // 최대 3초(3000ms) 안에는 멈추도록 설정
      //   setTimeout(function(){
      //     layoutHandler.stop();
      //   }, 3000);
      // });
      layoutHandler.run();
    }
  
    // on&off control: cy.edgehandles('enable') or cy.edgehandles('disable')
    cy.$api.edge = cy.edgehandles({
        preview: true,
        hoverDelay: 150,
        handleNodes: 'node',
        handlePosition: function( node ){ return 'middle top'; },
        handleInDrawMode: false,
        edgeType: function( sourceNode, targetNode ){ return 'flat'; },
        loopAllowed: function( node ){ return false; },
        nodeLoopOffset: -50,
      });
    cy.$api.edge.disable();

    cy.$api.unre = cy.undoRedo({
        isDebug: false, // Debug mode for console messages
        actions: {},// actions to be added
        undoableDrag: true, // Whether dragging nodes are undoable can be a function as well
        stackSizeLimit: undefined, // Size limit of undo stack, note that the size of redo stack cannot exceed size of undo stack
        ready: function () { // callback when undo-redo is ready
        }      
      });

    // Public Property : APIs about view and undoredo
    cy.$api.view = cy.viewUtilities({
      neighbor: function(node){
          return node.openNeighborhood();
      },
      neighborSelectTime: 600
    });

    // 이웃노드 찾기 : labels에 포함된 label을 갖는 node는 제외
    cy.$api.findNeighbors = function( node, uniqLabels, maxHops, callback=undefined ){
      // empty collection
      let connectedNodes = cy.collection();
      // if limit recursive, stop searching
      if( maxHops <= 0 ) return connectedNodes;

      // 새로운 label타입의 edge에 대한 connectedNodes 찾기
      // 1) 새로운 label 타입의 edges (uniqLabels에 없는)
      let connectedEdges = node.connectedEdges().filter(function(i, ele){
        return uniqLabels.indexOf(ele.data('label')) < 0;
      });
      // 2) edge에 연결된 node collection을 merge (중복제거)
      for( let i=0; i<connectedEdges.size(); i+=1 ){
        connectedNodes = connectedNodes.merge( connectedEdges[i].connectedNodes() );
      }
      // connectedNodes = connectedNodes.difference(node);                           // 자기 자신은 빼고
      // 3) uniqLabels 갱신
      connectedEdges.forEach(elem => {
        if( uniqLabels.indexOf(elem.data('label')) < 0 ){
          uniqLabels.push(elem.data('label'));
        } 
      });

      // 4) append recursive results
      maxHops -= 1;
      connectedNodes.difference(node).forEach(elem => {
        let collection = cy.$api.view.findNeighbors(elem, uniqLabels.slice(0), maxHops);
        connectedNodes = connectedNodes.merge( collection );
      });
      // 5) return connectedNodes
      // console.log( 'neighbors ==>', connectedNodes, uniqLabels, maxHops );

      // 6) callback run
      if( callback !== undefined ) callback();
      
      return connectedNodes;
    };


    // ==========================================
    // ==  cy cxtmenu 등록
    // ==========================================
    
    // cxt menu for core
    if( !_.isNil(cy._private.options.useCxtmenu) && cy._private.options.useCxtmenu )
      cy.cxtmenu({
        menuRadius: 80,
        selector: 'core',
        fillColor: 'rgba(0, 60, 0, 0.65)',
        commands: [{
            content: '<span style="display:inline-block; width:20px; font-size:10pt">Reverse select</span>',
            select: function(){
              let selected = cy.elements(':selected');
              let unselected = cy.elements(':unselected');
              cy.$api.view.removeHighlights();
              selected.unselect();
              unselected.select();
            }
          },{
            content: '<span style="display:inline-block; width:20px; font-size:10pt">Hide unselected</span>',
            select: function(){
              cy.$api.view.hide(cy.elements(":unselected"));
            },
          },{
            content: '<span style="display:inline-block; width:20px; font-size:10pt">Show all</span>',
            select: function(){
              cy.$api.view.show(cy.elements(":hidden"));
            },
          },{
            content: '<span style="display:inline-block; width:20px; font-size:10pt">Unlock all</span>',
            select: function(){
              cy.elements(":locked").unlock();
            }
          },{
            content: '<span style="display:inline-block; width:20px; font-size:10pt">Remove expands</span>',
            select: function(){
              cy.elements(".expand").remove();
            }
          }
        ]
      });
  };


  /////////////////////////////////////////////////////////
  //  NAMESPACE: agens.graph
  /////////////////////////////////////////////////////////

  // Public Function : loadData()
  agens.graph.loadData = function(data){
    if( agens.cy === null ) return;

    // initialize
    agens.cy.elements().remove();

    agens.cy.batch(function(){
      // load data
      if( data.elements.nodes ){
        data.elements.nodes.map((ele) => {
          ele.group = "nodes";
          agens.cy.add( ele );
        });
      }
      if( data.elements.edges ){
        data.elements.edges.map((ele) => {
          ele.group = "edges";
          agens.cy.add( ele );
        });
      }

      // refresh style
      agens.cy.style(agens.graph.stylelist['dark']).update();
      // refit canvas
      agens.cy.fit( agens.cy.elements(), 30);
      // save original positions
      agens.graph.savePositions();
    });
  };

  // save Nodes' positions (original position)
  agens.graph.savePositions = function(){
    agens.caches.reset('nodePosition');
    agens.cy.nodes().map(ele => {
      let pos = ele.position();
      agens.caches.nodePosition.set( ele, {x: pos.x, y: pos.y} );
    })
  };

  // private Function
  agens.graph.makeid = function(){
    let text = "_id_";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( let i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
  };

  agens.graph.exportImage = function(filename, watermark){
    if( agens.cy === null ) return;

    // image data
    let pngContent = agens.cy.png({ maxWidth : '1600px', full : true, scale: 1.2 });

    // this is to remove the beginning of the pngContent: data:img/png;base64,
    let b64data = pngContent.substr(pngContent.indexOf(",") + 1);
    let blob = b64toBlob(b64data, "image/png");

    // watermark 없으면 그냥 saveAs
    if( watermark === null || watermark === '' ) saveAs(blob, filename);
    // watermark 추가
    else {
      let blobUrl = URL.createObjectURL(blob);
      $('<img>', {
        src: blobUrl
      }).watermark({
        text: watermark, textSize: 40, textWidth: 800, textColor: 'white', opacity: 0.7, margin: 5,
        outputType: "png", outputWidth: 'auto', outputHeight: 'auto',
        done: function(imgURL){
          let b64data2 = imgURL.substr(imgURL.indexOf(",") + 1);
          let blob2 = b64toBlob(b64data2, "image/png")
          saveAs(blob2, filename);
          console.log( `image saved: "${filename}"`);
        }
      });
     }
  };

  // see http://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
  function b64toBlob(b64Data, contentType, sliceSize) {
    contentType = contentType || '';
    sliceSize = sliceSize || 512;

    let byteCharacters = atob(b64Data);
    let byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        let slice = byteCharacters.slice(offset, offset + sliceSize);
        let byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        let byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    let blob = new Blob(byteArrays, {type: contentType});
    return blob;
  };

}( window.agens = window.agens || {} ));
