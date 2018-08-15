import { Component, OnInit, NgZone, ViewChild, ElementRef, Inject, Output, EventEmitter} from '@angular/core';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material';

import { Observable, Subject } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle } from '../../../../models/agens-data-types';
import { Label, Element, Node, Edge } from '../../../../models/agens-graph-types';

import * as CONFIG from '../../../../app.config';

declare var _: any;
declare var $: any;
declare var agens: any;

@Component({
  selector: 'app-meta-graph',
  templateUrl: './meta-graph.component.html',
  styleUrls: ['./meta-graph.component.scss']
})
export class MetaGraphComponent implements OnInit {

  isVisible: boolean = false;
  metaGraph: IGraph = undefined;

  gid: number = undefined;
  cy: any = undefined;      // for Graph canvas
  labels: ILabel[] = [];    // for Label chips

  selectedElement: any = undefined;  

  // material elements
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;

  constructor(
    private _ngZone: NgZone,    
    private _api: AgensDataService,
    private _util: AgensUtilService,
    private _sheetRef: MatBottomSheetRef<MetaGraphComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any        
  ) {
    this.metaGraph = (this.data) ? _.cloneDeep(this.data['metaGraph']) : undefined;
  }

  ngOnInit() {
    // prepare to call this.function from external javascript
    window['metaGraphComponentRef'] = {
      zone: this._ngZone,
      cyCanvasCallback: () =>{ if(this.isVisible) this.cyCanvasCallback() },
      cyElemCallback: (target) =>{ if(this.isVisible) this.cyElemCallback(target) },
      cyQtipMenuCallback: (target, value) =>{ if(this.isVisible) this.cyQtipMenuCallback(target, value) },
      component: this
    };

    // Cytoscape 생성
    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        selectionType: 'single',    // 'single' or 'additive'
        boxSelectionEnabled: false, // if single then false, else true
        useCxtmenu: false,           // whether to use Context menu or not
        hideNodeTitle: false,        // hide nodes' title
        hideEdgeTitle: false,        // hide edges' title
      });
    this.cy.userZoomingEnabled( true );
  }

  ngOnDestroy(){
    // 내부-외부 함수 공유 해제
    window['metaGraphComponentRef'] = undefined;
  }

  ngAfterViewInit() {
    if( this.metaGraph ) this.initLoad();
  }

  close(): void {
    this._sheetRef.dismiss();
    event.preventDefault();
  }

  initLoad(){
    this.metaGraph.nodes.forEach(e => {
      this.cy.add( e );
    });
    this.metaGraph.edges.forEach(e => {
      this.cy.add( e );
    });
    this.initCanvas();

    this.changeLayout( this.cy.elements() );
  }

  /////////////////////////////////////////////////////////////////
  // Canvas Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback():void {
    this.selectedElement = undefined;
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    // null 이 아니면 정보창 (infoBox) 출력
    this.selectedElement = target;
    console.log( 'cyElemCallback', target._private.data );
  }  

  // Neighbor Label 로의 확장
  cyQtipMenuCallback( target:any, value:string ){
    console.log( 'qtipMenuCallback:', target, value );
    // let expandId = target.data('label')+'_'+target.data('id');
    // target.scratch('_expandid', expandId);
    // let position = target.position();
    // let boundingBox = { x1: position.x - 40, x2: position.x + 40, y1: position.y - 40, y2: position.y + 40 };
    // this.runExpandTo( target, targetLabel );
  }

  
  /////////////////////////////////////////////////////////////////
  // Graph Controllers
  /////////////////////////////////////////////////////////////////

  // for banana javascript, have to use 'document.querySelector(...)'
  toggleProgressBar(option:boolean = undefined){
    let graphProgressBar:any = document.querySelector('div#progressBarMetaGraph');
    if( !graphProgressBar ) return;

    if( option === undefined ) option = !((graphProgressBar.style.visibility == 'visible') ? true : false);
    // toggle progressBar's visibility
    if( option ) graphProgressBar.style.visibility = 'visible';
    else graphProgressBar.style.visibility = 'hidden';
  } 

  // 결과들만 삭제 : runQuery 할 때 사용
  clear(){
    // 그래프 비우고
    this.cy.elements().remove();
    // 그래프 라벨 칩리스트 비우고
    this.labels = [];
    this.selectedElement = undefined;
  }

  setGid( gid:number ){ this.gid = gid; }
  addLabel( label:ILabel ){
    this.labels.push( label );
  }
  addNode( ele:INode ){
    this.cy.add( ele );
  }
  addEdge( ele:IEdge ){
    this.cy.add( ele );
  }

  addProperties( nodes:any[] ){
    nodes.forEach(ele => {
      if( !ele._private.data.props.hasOwnProperty('propsCount') ) return true;
      let propsCount:Map<string,any> = ele._private.data.props['propsCount'];

      Object.keys(propsCount).forEach(k => {
        let pNode = <INode>{ group: 'nodes', data: {
            id: ele._private.data.id + ':' + k,
            // parent: ele._private.data.id,
            label: 'property',
            props: {},
            size: propsCount[k]
          },
          scratch: {
            _style: <IStyle>{
              color: ele._private.scratch._style.color, width: '20px', title: k, visible: true
            }},
          classes: 'expand' 
        };
        pNode.data['owner'] = ele._private.data.id;
        pNode.data['name'] = k;
        let pEdge = <IEdge>{ group: 'edges', data: {
            id: ele._private.data.id + ':has:' + k,
            label: 'property',
            source: ele._private.data.id,
            target: ele._private.data.id + ':' + k,
            props: {},
            size: 1
          },
          scratch: {
            _style: <IStyle>{
              color: ele._private.scratch._style.color, width: '2px', title: undefined, visible: true
            }},
          classes: 'expand' 
        };
        pEdge.data['owner'] = ele._private.data.id;

        this.cy.add( pNode );
        this.cy.add( pEdge );
      });
    });
  }

  // 데이터 불러오고 최초 적용되는 작업들 
  initCanvas(){
    // add groupBy menu
    this.addQtipMenu( this.cy.elements() );
    // add Properties of Node
    this.addProperties(this.cy.nodes());
    // refresh style
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.fit( this.cy.elements(), 50);
  }
  // 액티브 상태가 될 때마다 실행되는 작업들
  refreshCanvas(){
    this.cy.resize();
    this.cy.$api.view.hide( this.cy.elements(`[label='property']`) );
    this.changeLayout( this.cy.elements(`[label!='property']`) );
    agens.cy = this.cy;
  }

  changeLayout( elements ){
    let options = { name: 'cose',
      nodeDimensionsIncludeLabels: true, fit: true, padding: 50, animate: false, 
      randomize: false, componentSpacing: 80, nodeOverlap: 4,
      idealEdgeLength: 50, edgeElasticity: 50, nestingFactor: 1.5,
      gravity: 0.5, numIter: 1000
    };    
    // adjust layout
    elements.layout(options).run();
  }

  layoutProperties( targets:any[] ){    
    targets.forEach(p => {
      if( !p._private.data.props.hasOwnProperty('propsCount') ) return true;
      let elements = this.cy.elements(`[owner='${p.id()}']`);
      elements.add(p);

      let position = p.position();
      let boundingBox = { x1: position.x - 300, x2: position.x + 300, y1: position.y - 300, y2: position.y + 300 };
      console.log( 'layoutProperties', p._private.data, boundingBox );

      let expandLayout:any = {
        name: 'concentric',
        fit: true,                          // whether to fit the viewport to the graph
        padding: 50,                        // the padding on fit
        startAngle: 3 / 2 * Math.PI,        // where nodes start in radians
        sweep: undefined,                   // how many radians should be between the first and last node (defaults to full circle)
        clockwise: true,                    // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
        equidistant: false,                 // whether levels have an equal radial distance betwen them, may cause bounding box overflow
        minNodeSpacing: 10,                 // min spacing between outside of nodes (used for radius adjustment)
        boundingBox: boundingBox,           // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
        avoidOverlap: true,                 // prevents node overlap, may overflow boundingBox if not enough space
        nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
        concentric: function( node ){ return node.degree(); },  // returns numeric value for each node, placing higher nodes in levels towards the centre
        levelWidth: function( nodes ){ return nodes.maxDegree() / 4; }, // the variation of concentric values in each level
        animate: false,                     // whether to transition the node positions
      };

      setTimeout(() => {
        elements.makeLayout(expandLayout).run();
      }, 100);        
    });
  }

  /////////////////////////////////////////////////////////////////
  // Properties Controllers
  /////////////////////////////////////////////////////////////////

  addQtipMenu( elements:any ){
    //
    // **NOTE: cy.on('cxttap', fun..) 구문을 사용하면 안먹는다 (-_-;)
    // 
    // mouse right button click event on nodes
    elements.qtip({
      content: function() {
        // return 'Example qTip on ele ' + this.id();
        let menuHtml:string = `<div class="hide-me"><h4>groupBy( ${this.data('name')} )</h4><hr/><ul>`
                  + `<li><a href="javascript:void(0);" onclick="agens.cy.$api.cyQtipMenuCallback('${this.data('name')}','');">`
                  + `All <i class="material-icons">keyboard_arrow_left</i></a></li>`;
        let props:Map<string,any> = this.data('props').propsCount;
        Object.keys(props).forEach(k => {
          menuHtml += `<li><a href="javascript:void(0);" onclick="agens.cy.$api.cyQtipMenuCallback('${this.data('name')}','${k}');">`
                  + `${k} (size=${props[k]}) <i class="material-icons">keyboard_arrow_left</i></a></li>`;
        });
        return menuHtml+'</ul></div>';
      },
      style: { classes: 'qtip-bootstrap', tip: { width: 24, height: 8 } },
      position: { target: 'mouse', adjust: { mouse: false } },
      events: { visible: function(event, api) { $('.qtip').click(function(){ $('.qtip').hide(); }); } },
      show: { event: 'cxttap' },          // cxttap: mouse right button click event
      hide: { event: 'click unfocus' }
    });    
  }

  unfoldProperties(){
    this.layoutProperties( this.cy.nodes(`[label!='property']`) );
    this.cy.$api.view.show( this.cy.elements(`[label='property']`) );
    setTimeout(() => {
      this.cy.style(agens.graph.stylelist['dark']).update();
      this.cy.fit( this.cy.elements(), 50);
    }, 100);
  }

  foldProperties(){
    this.cy.$api.view.hide( this.cy.elements(`[label='property']`) );
    this.cy.fit( this.cy.elements(), 50);
  }
}
