import { Component, OnInit, NgZone, ViewChild, ElementRef, Input} from '@angular/core';
import { MatDialog, MatButtonToggle } from '@angular/material';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle } from '../../../../models/agens-data-types';
import { Label, Element, Node, Edge } from '../../../../models/agens-graph-types';

import * as CONFIG from '../../../../global.config';

declare var agens: any;


@Component({
  selector: 'app-meta-graph',
  templateUrl: './meta-graph.component.html',
  styleUrls: ['./meta-graph.component.scss','../../graph.component.scss']
})
export class MetaGraphComponent implements OnInit {

  isVisible: boolean = false;
  isFirstOnData: boolean = false;

  gid: number = undefined;
  cy: any = undefined;      // for Graph canvas
  labels: ILabel[] = [];    // for Label chips

  selectedElement: any = undefined;  
  timeoutNodeEvent: any = undefined;    // neighbors 선택시 select 추가를 위한 interval 목적

  // material elements
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;

  constructor(
    private _ngZone: NgZone,    
    private dialog: MatDialog,
    private _api: AgensDataService,
    private _util: AgensUtilService,
  ) { 
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
  }

  ngOnDestroy(){
    // 내부-외부 함수 공유 해제
    window['metaGraphComponentRef'] = undefined;
  }

  ngAfterViewInit() {
    // Cytoscape 생성
    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        selectionType: 'single',    // 'single' or 'additive'
        boxSelectionEnabled: false, // if single then false, else true
        useCxtmenu: false,           // whether to use Context menu or not
        hideNodeTitle: false,        // hide nodes' title
        hideEdgeTitle: false,        // hide edges' title
      });
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
  }  

  // Neighbor Label 로의 확장
  cyQtipMenuCallback( target:any, targetLabel:string ){
    let expandId = target.data('label')+'_'+target.data('id');
    target.scratch('_expandid', expandId);

    let position = target.position();
    let boundingBox = { x1: position.x - 40, x2: position.x + 40, y1: position.y - 40, y2: position.y + 40 };

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
    this.timeoutNodeEvent = undefined;
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
              color: ele._private.scratch._style.color, width: '20px', title: k
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
              color: ele._private.scratch._style.color, width: '2px', title: undefined
            }},
          classes: 'expand' 
        };
        pEdge.data['owner'] = ele._private.data.id;

        this.cy.add( pNode );
        this.cy.add( pEdge );
      });
    });
  }


  refresh(){
    // add Properties of Node
    this.addProperties(this.cy.nodes());
    // refresh style
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.fit( this.cy.elements(), 50);
  }
  resize(){
    this.cy.resize();
    this.cy.$api.view.hide( this.cy.elements(`[label='property']`) );
    this.cy.$api.changeLayout('klay', {
      "elements": this.cy.elements(`[label!='property']`)
      , "padding": 50
      , "ready": () => this.toggleProgressBar(true)
      , "stop": () => this.toggleProgressBar(false)
    });
    agens.cy = this.cy;

    // setTimeout(() => {
    //   console.log( 'layoutProperties does not work. Why?' );
    //   this.layoutProperties( this.cy.nodes(`[label!='property']`) );
    // }, 1000);
  }
  refreshCanvas(){
    this.refresh();
    this.resize();
  }

  layoutProperties( targets:any[] ){    
    targets.forEach(p => {
      if( !p._private.data.props.hasOwnProperty('propsCount') ) return true;
      let elements = this.cy.elements(`[owner='${p.id()}']`);
      elements.add(p);

      let position = p.position();
      let margin = 400 + parseInt(p._private.scratch._style.width.replace('px',''));
      let boundingBox = { x1: position.x - margin, x2: position.x + margin, y1: position.y - margin, y2: position.y + margin };

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
