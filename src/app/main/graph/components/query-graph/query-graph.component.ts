import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, NgZone, Output, EventEmitter, AfterViewInit, OnDestroy } from '@angular/core';
import { MatDialog, MatButtonToggle, MatButton, MatSlideToggle, MatBottomSheet } from '@angular/material';
import { FormControl } from '@angular/forms';

import { HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http';

import { Observable, Subject, interval, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { OverlayGraphComponent } from '../../sheets/overlay-graph/overlay-graph.component';
import { MetaGraphComponent } from '../../sheets/meta-graph/meta-graph.component';
import { EditGraphComponent } from '../../sheets/edit-graph/edit-graph.component';
import { TimelineSliderComponent } from '../timeline-slider/timeline-slider.component';
import { ImageExportDialog } from '../../dialogs/image-export.dialog';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { AgensGraphService } from '../../../../services/agens-graph.service';

import { IGraph, ILabel, IElement, INode, IEdge, IStyle, IEnd, IProperty } from '../../../../models/agens-data-types';
import { IGraphDto, IDoubleListDto, IResponseDto } from '../../../../models/agens-response-types';

import * as CONFIG from '../../../../app.config';

import * as moment from 'moment';

declare var jQuery: any;
declare var _: any;
declare var agens: any;

@Component({
  selector: 'app-query-graph',
  templateUrl: './query-graph.component.html',
  styleUrls: ['./query-graph.component.scss','../../graph.component.scss'],
  host: {
    '(document:keyup)': 'handleKeyUpEvent($event)',
    '(document:keydown)': 'handleKeyDownEvent($event)'
  }
})
export class QueryGraphComponent implements OnInit, AfterViewInit, OnDestroy {

  private api_handler:Subscription = undefined;

  isVisible: boolean = false;
  isLoading: boolean = false;
  isTempGraph: boolean = false;
  canvasHover: boolean = false;
  withShiftKey: boolean = false;

  private cyDoubleClickDelayMs = 350;
  private cyPreviousTapStamp;

  selectedOption: string = undefined;
  btnStatus: any = { 
    showHideTitle: false,     // Node Title 노출여부 
    mouseWheel: false,        // 마우스휠 사용여부
    shortestPath: false,      // 경로검색 사용여부 
    neighbors: false,         // 이웃노드 하일라이팅
    connectedGroup: false,
    timeLine: false,          // 타임라인
    findCycles: false,        // 사이클 디텍션
    editGraph: false,
    megtGraph: false,
    valueCentrality: false,   // centrality by property's value 
    labelStyle: false,
    editMode: false,          // Edit Mode : create node/edge, edit data
    overlayGraph: false       // overlay Graph : when false, then remove overlayed graph
  };
  labelSearchCount: number = 0;
  labelSearchItems: string[] = [];

  gid: number = undefined;
  cy: any = undefined;      // for Graph canvas
  ur: any = undefined;      // cy undoRedo
  labels: ILabel[] = [];    // for Label chips    <== 모든 스타일 정보 유지

  dataGraph: IGraph = undefined;
  metaGraph: IGraph = undefined;
  tempGraph: IGraph = undefined;

  selectedElement: any = undefined;  
  selectedLabel: ILabel = undefined;
  displayedLabelColumns: string[] = ['propName', 'propType', 'propCnt'];

  timeoutNodeEvent: any = undefined;    // neighbors 선택시 select 추가를 위한 interval 목적

  shortestPathOptions:any = { sid: undefined, eid: undefined, directed: false, order: 0, distTo: undefined };
  grph_data: string[][] = [];

  // ** Styles **
  colorsPallet: any[] = [];         // colors Pallet  
  
  // ** Timelines **
  timelineLabelCtl: FormControl;
  timelinePropertyCtl: FormControl;
  timelineFormatCtl: FormControl;
  timelineSampleCtl: FormControl;
  timelineDisabled: boolean = true;
  timeline_data: string[] = [];

  // material elements
  @ViewChild('btnShortestPath') public btnShortestPath: MatButtonToggle;
  @ViewChild('slideShortestPathDirected') public slideSPathDirected: MatSlideToggle;
  @ViewChild('btnEditMode') public btnEditMode: MatButtonToggle;
  @ViewChild('btnShowHideTitle') public btnShowHideTitle: MatButtonToggle;
  @ViewChild('btnHighlightNeighbors') public btnHighlightNeighbors: MatButtonToggle;
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;
  @ViewChild('timelineSlider') timelineSlider: TimelineSliderComponent;
  @ViewChild('btnSetTimeline') public btnSetTimeline: MatButton;
  @ViewChild('divFindTitle', {read: ElementRef}) divFindTitle: ElementRef;
  @ViewChild('imageSelector', {read: ElementRef}) imageSelector: ElementRef;
  @ViewChild('imageSelected', {read: ElementRef}) imageSelected: ElementRef;
  
  @Output() initDone:EventEmitter<boolean> = new EventEmitter();
  todo$:Subject<any> = new Subject();
    
  constructor(
    private _ngZone: NgZone,
    private _cd: ChangeDetectorRef,
    private _dialog: MatDialog,    
    private _api: AgensDataService,
    private _util: AgensUtilService,
    private _graph: AgensGraphService,
    private _sheet: MatBottomSheet
  ) { 
    this.colorsPallet = this._util.colors;
  }

  ngOnInit() {
    // Cytoscape 생성
    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        selectionType: 'additive',  // 'single' or 'additive'
        boxSelectionEnabled: true,  // if single then false, else true
        useCxtmenu: true,           // whether to use Context menu or not
        hideNodeTitle: true,        // hide nodes' title
        hideEdgeTitle: true,        // hide edges' title
    });
    // prepare to call this.function from external javascript
    window['angularComponentRef'] = {
      zone: this._ngZone,
      qtipCxtMenu: (action) => this.qtipCxtMenu(action),
      qtipEleMenu: (action, targets) => this.qtipEleMenu(action, targets),
      component: this
    };

    this.divCanvas.nativeElement.style.cursor = 'pointer';   // Finger
  }

  ngOnDestroy(){
    window['angularComponentRef'] = null;
    if( this.api_handler ) this.api_handler.unsubscribe();
  }

  ngAfterViewInit() {
    // cy events : click
    this.cy.on('tap', (e) => { 
      if( e.target === this.cy ) this.cyCanvasCallback(e);
      else if( e.target.isNode() || e.target.isEdge() ) this.cyElemCallback(e.target);

      // sideEffect actions
      if( this.btnStatus.valueCentrality ) this.btnStatus.valueCentrality = false;  // close box

      // change Detection by force
      this._cd.detectChanges();
    });

    // only canvas trigger doubleTap event
    this.cy.on('doubleTap', (e, originalTapEvent) => {
      if( this.btnStatus.editMode ){
        if( originalTapEvent.position ){
          // undefined => new node
          let target:any = { group: 'nodes', data: { id: agens.graph.makeid(), label: '', props: {}, size: 1 }
                , position: originalTapEvent.position, classes: "new" };
          this.openSheetEditElement( target );
        }
      }
    });

    // cy events: edge 생성
    this.cy.on('ehcomplete', (event, sourceNode, targetNode, addedEles) => {
      let { position } = event;
      this.cy.elements(':selected').unselect();      
      
      let element:any = _.cloneDeep( addedEles.first().json() );
      element.data.label = '';
      element.data.props = {};
      element.classes = "new";
      // this.cy.remove( addedEles );            // remove oldEdge having temporary id

      this.openSheetEditElement( element, () => { this.cy.remove( addedEles ); } );   // 생성되는 edge 속성값 작성하기
      // send edge to server and get NEW ID
      // => re-create edge on canvas
    });

    // cy undoRedo initialization
    this.ur = this.initUndoRedo(this.cy, this.gid);

    Promise.resolve(null).then(() => {
      // Cytoscape 바탕화면 qTip menu
      let tooltip = this.cy.qtip({
        content: jQuery('#divCxtMenu').html(),
        // function(e){ 
        //   let html:string = `<div class="hide-me"><h4><strong>Menu</strong></h4><hr/><ul>`;
        //   html += `<li><a href="javascript:void(0)" onclick="agens.cy.$api.qtipFn('newNode')")>create new NODE</a></li>`;
        //   html += `</ul></div>`;
        //   return html;
        // },
        show: { event: 'cxttap', cyBgOnly: false /* true */ },    // cyBgOnly : element 위에서는 작동 안되게 할 것인지
        hide: { event: 'click unfocus' },
        position: { target: 'mouse', adjust: { mouse: false } },
        style: { classes: 'qtip-bootstrap', tip: { width: 16, height: 8 } },
        events: { visible: (event, api) => { jQuery('.qtip').click(() => { jQuery('.qtip').hide(); }); }}
      });

    });

  }

  setData(dataGraph:IGraph){
    this.dataGraph = dataGraph;
    this.dataGraph.labels_size = dataGraph.labels.length;
    this.dataGraph.nodes_size = dataGraph.nodes.length;
    this.dataGraph.edges_size = dataGraph.edges.length;
    dataGraph.labels.forEach(x => {
      let eles = (x.type == 'nodes') 
                ? dataGraph.nodes.filter(y => y.data.label == x.name) 
                : dataGraph.edges.filter(y => y.data.label == x.name);
      x.size = eles.length;     // update eles size of label
    });
    // label 정렬 : node>edge 순으로, size 역순으로
    this.labels = [... _.orderBy(dataGraph.labels, ['type','size'], ['desc','desc'])];    
    // set node style of background-image
    setTimeout(()=>{
      let baseUrl = localStorage.getItem(CONFIG.DOWNLOAD_URL);
      if( baseUrl != null && baseUrl.length > 0 )
        this.cy.nodes().forEach(e => {
          if( e._private.scratch._style['image'] ){
            e.style('background-image', baseUrl+e._private.scratch._style['image']);
          }
        });
    }, 100);
  }

  // ** Copy/Cut/Paste: Ctrl+C, +X, Ctrl+V
  handleKeyUpEvent(event: KeyboardEvent) { 
    let charCode = String.fromCharCode(event.which).toLowerCase();
    if (this.canvasHover && event.ctrlKey) {
      console.log( 'keyPress: Ctrl + '+charCode, this.canvasHover );
      // key : undo/redo
      if( charCode == "z" ) this.cy.$api.unre.undo();
      else if( charCode == "y" ) this.cy.$api.unre.redo();
      // key : copy/cut/paste
      // **참고 https://github.com/iVis-at-Bilkent/cytoscape.js-clipboard
      else if( charCode == "a" ) { 
        this.cy.elements(":visible").select(); event.preventDefault(); 
      }
      else if( charCode == "c" ) this.ur.do('copy', this.cy.elements(":selected"), this.gid);
      else if( charCode == "x" ) this.ur.do('cut', this.cy.elements(":selected"), this.updateGraph);
      else if( charCode == "v" ){
        this.ur.do('paste', this.updateGraph);
      }
      // key: new node/edge, edit data
      else if( charCode == 'e' ) this.toggleEditMode();
    }
    if (!event.shiftKey) {
      this.withShiftKey = false;    // multi selection 해제
    }
  }

  handleKeyDownEvent(event: KeyboardEvent) { 
    if (event.shiftKey) {
      this.withShiftKey = true;     // multi selection 가능
    }
  }

  /////////////////////////////////////////////////////////////////
  // Edit Mode : create node/edge, edit data
  /////////////////////////////////////////////////////////////////

  toggleEditMode(checked?:boolean){
    if( checked === undefined ) this.btnEditMode.checked = !this.btnEditMode.checked;
    else this.btnEditMode.checked = checked;
    this.btnStatus.editMode = this.btnEditMode.checked;

    if( this.btnStatus.editMode ){      // editMode on
      this.cy.$api.edge.enable();
      this.divCanvas.nativeElement.style.cursor = 'cell';     // PLUS
    }
    else{                               // editMode off
      this.cy.$api.edge.disable();
      this.divCanvas.nativeElement.style.cursor = 'pointer';  // Default
    }
  }

  /////////////////////////////////////////////////////////////////
  // Copy/Cut/Paste : TinkerGraph sync
  /////////////////////////////////////////////////////////////////

  updateGraph(oper:string, nodes:any[], edges:any[], callback:Function=undefined){
    let data:any = { gid: this.gid, graph: { labels: [],
      nodes: nodes ? nodes.map(x => { 
        return { "group": 'nodes', "id": x.data.id, "label": x.data.label, "size": x.data.size, "props": x.data.props,
                  "name": x.data.hasOwnProperty('name') ? x.data.name : '' }; }) : [],
      edges: edges ? edges.map(x => { 
        return { "group": 'nodes', "id": x.data.id, "label": x.data.label, "size": x.data.size, "props": x.data.props,
                  "source": x.data.source, "target": x.data.target, "name": x.data.hasOwnProperty('name') ? x.data.name : '' }; }) : [],
    }};
    this._api.grph_update(this.gid, oper, data).subscribe(
      x => {
        if( callback ) (callback)();
        // console.log( 'grph_update:', this.gid, oper, x );
        this._api.setResponses(<IResponseDto>{
          group: 'update::'+oper,
          state: x.state,
          message: (<string>x.message).replace('tinkergraph','')
        });        
      }
    );
  }

  initUndoRedo(cy, gid):any{
    if( !cy || !cy.undoRedo ) return undefined;

    let ur = cy.undoRedo({}, true);
    ur.clipboard = {};
    ur.ids = new Map<string,string>();    // element's id Mapper for paste

    ur.newId = function(length:number=12):string{
      let chars = "abcdefghijklmnopqrstufwxyzABCDEFGHIJKLMNOPQRSTUFWXYZ1234567890"
      let newId = (_.sampleSize(chars, length || 12)).join('');   // lodash v4
      let exists = Array.from(ur.ids.values());
      while( exists.includes(newId) ){
        newId = (_.sampleSize(chars, length || 12)).join('');     // again
      }
      return newId;
    }
  
    ur.copy2cb = function(eles:any){
      eles.unselect();
      let descs = eles.nodes().descendants();
      let nodes = eles.nodes().union(descs).filter(":visible");
      let edges = nodes.edgesWith(nodes).filter(":visible");
  
      // **NOTE: clone() 사용시 scratch{} 내용이 복사되지 않음
      let nodes_json = nodes.map( e => {
        let obj = e.json();
        obj.scratch = _.cloneDeep(e._private.scratch);
        obj.position = _.clone(e._private.position);
        obj.classes = 'clone';
        return obj;
      });
      ur.clipboard['nodes'] = nodes_json;
      let edges_json = edges.map( e => {
        let obj = e.json();
        obj.scratch = _.cloneDeep(e._private.scratch);
        obj.position = {};
        obj.classes = 'clone';
        return obj;
      });
      ur.clipboard['edges'] = edges_json;
    }
  
    // register actions
    ur.action('invisible',      
      (eles:any) => { 
        // style('visibility', 'hidden') 시키면, eles 가 삭제되어 찾을 수 없음
        ur.clipboard['hidden'] = eles; 
        eles.style('visibility', 'hidden'); 
        return eles;
      },
      (eles:any) => { 
        if( ur.clipboard['hidden'] ){
          ur.clipboard['hidden'].style('visibility', 'visible');
          ur.clipboard['hidden'] = undefined;
        } 
        return eles;
      });      
    ur.action('grouping',
      (eles:any) => { 
        parent = this.cy.$api.grouping( eles );      
        return eles;   
      },
      (eles:any) => { 
        let parents:any = eles.parent();
        parents.forEach(target => { this.cy.$api.degrouping(target); });
        return eles;   
      });
    ur.action('degrouping',
      (target:any) => { 
        if( !target || target.hasClass('overlay') ) return undefined;
        this.cy.$api.degrouping( target ); 
        return target;
      },
      (target:any) => { 
        if( !target || target.hasClass('overlay') ) return undefined;
        target.restore();
        if( target.scratch('_memebers') ) this.cy.$api.grouping( target.scratch('_memebers'), target );
        return target;
      });

    ur.action('copy',      // actionName
      (eles:any) => {      // do Func
        ur.copy2cb(eles);
        return eles;
      },
      () => {              // undo Func
        ur.clipboard = {};
      });

    ur.action('cut',       // actionName
      (eles:any) => {      // do Func
        ur.copy2cb(eles);
        // TinkerGraph update::delete
        this.updateGraph('delete', ur.clipboard['nodes'], ur.clipboard['edges']);
        // **NOTE: copy 대상이 아닌 edge 들이 덩달아 지워진것도 포함됨
        ur.clipboard['removed'] = eles.remove();
        this.recountingLabels();        // recount labels
        return eles;
      },
      () => {              // undo Func
        // TinkerGraph update::upsert
        this.updateGraph('upsert', ur.clipboard['nodes'], ur.clipboard['edges']);
        // restore removed elements
        if( ur.clipboard['removed'] ){
          ur.clipboard['removed'].restore();
          ur.clipboard['removed'] = undefined;
        } 
        this.recountingLabels();        // recount labels
      });

    ur.action('delete',    // actionName
      (eles:any) => {      // do Func
        ur.copy2cb(eles);
        // TinkerGraph update::delete
        this.updateGraph('delete', ur.clipboard['nodes'], ur.clipboard['edges']);
        // **NOTE: copy 대상이 아닌 edge 들이 덩달아 지워진것도 포함됨
        ur.clipboard['removed'] = eles.remove();       
        this.recountingLabels();        // recount labels        
      },
      () => {              // undo Func
        // TinkerGraph update::upsert
        this.updateGraph('upsert', ur.clipboard['nodes'], ur.clipboard['edges']);
        // restore removed elements
        if( ur.clipboard['removed'] ){
          ur.clipboard['removed'].restore();
          ur.clipboard['removed'] = undefined;
        } 
        this.recountingLabels();        // recount labels        
      });
    ur.action('create',
      (json:any) => {
        if( json.group == 'nodes' ) this.updateGraph('upsert', [json], []);
        else this.updateGraph('upsert', [], [json]);
        let ele = this.cy.add( json );
        this.recountingLabels();        // recount labels        
        return ele;
      },
      (ele:any) => {
        if( ele.group() == 'nodes' ) this.updateGraph('delete', [ele.json()], []);
        else this.updateGraph('delete', [], [ele.json()]);
        let tmp = ele.remove();
        this.recountingLabels();        // recount labels        
        return tmp;
      }
    );

    ur.action('paste',     // actionName
      () => {              // do Func
        let stack = ur.getUndoStack();
        if( stack.length < 1 || !['copy','cut','paste'].includes(stack[stack.length-1]['name']) ) return;
        if( !ur.clipboard['nodes'] || !ur.clipboard['edges'] ) return;        

        // TinkerGraph update::upsert
        this.updateGraph('upsert', ur.clipboard['nodes'], ur.clipboard['edges']);

        let eles = cy.collection();
        // **NOTE: nodes 는 id만 변경, 
        //         edges 는 id 외에도 source와 target 변경
        let nodes = ur.clipboard['nodes'].map(e => {
          let x = _.cloneDeep(e);
          let newId = ur.newId();
          ur.ids.set( x.data.id, newId);   
          x.data.id = newId;      // new ID : random string
          x.position.x += 70;     // 우측 상단
          x.position.y -= 20;     // 우측 상단
          return cy.add(x);
        });
        nodes.forEach( e => eles = eles.add( e ) );
        let edges = ur.clipboard['edges'].map(e => {
          let x = _.cloneDeep(e);
          let newId = ur.newId(); 
          ur.ids.set( x.data.id, newId);
          x.data.id = newId;      // new ID : random string
          x.data.source = ur.ids.get(x.data.source);
          x.data.target = ur.ids.get(x.data.target);
          return cy.add(x);
        });
        edges.forEach( e => eles = eles.add( e ) );
        ur.clipboard['pasted'] = eles;
        this.recountingLabels();        // recount labels
      },
      () => {           // undo Func
        // TinkerGraph update::delete
        this.updateGraph('delete', ur.clipboard['nodes'], ur.clipboard['edges']);
        if( ur.clipboard['pasted'] ){
          ur.clipboard['pasted'].remove();
          ur.clipboard['pasted'] = undefined;
        } 
        this.recountingLabels();        // recount labels
      });

    return ur;
  }


  /////////////////////////////////////////////////////////////////
  // Style Controllers
  /////////////////////////////////////////////////////////////////

  //////////////////////////////////////////////////////////
  //
  // 스타일 컨트롤러를 변경하면 진행되는 일
  //   1) nodes, edges 에 따라 아래 스타일 변경 
  //   2) meta class 로 style() 함수에서 스타일 변경
  //   3) scratch() 함수로 _style 에 저장 
  //   4) _style 값을 close()에서 data-graph, label, meta-graph 에 반영 

  resetNodeImage(label:ILabel){
    this.imageSelector.nativeElement.value = '';
    if( label ) label.scratch._style['image'] = undefined;
    this.cy.nodes(`[label='${label.name}']`).forEach(e => {
      e._private.scratch._style['image'] = undefined;
      e.style('background-image', null);
    });
  }

  importNodeImage(label:ILabel, event){
    let fileItem:File = event.target.files[0];
    if( fileItem.size > 2097152 ){
      // error message
      this._api.setResponses(<IResponseDto>{ group: 'label-style', state: 'WARNING', 
          message: `**NOTE: image file is too big more than 2M. recommend 32x32 ` });
      return;
    }

    console.log( 'importImage:', label, fileItem);
    this.api_handler = this._api.fileUpload( fileItem ).subscribe(
      x => {
        // progress return 
        // => {type: 1, loaded: 35557, total: 35557} ... {type: 3, loaded: 147}
        if( x.type === HttpEventType.UploadProgress) {
          const percentDone = Math.round(100 * ( x.loaded / x.total ) );
          if( percentDone ) console.log(`import.progress: ${percentDone}%` );
        }
        else if (x instanceof HttpResponse) {
          // console.log('File is completely uploaded!', fileItem.name, x);
          // save file-name to label style
          this.imageSelected.nativeElement.value = fileItem.name;
          label.scratch._style['image'] = fileItem.name;
          // set node style of background-image
          let baseUrl = localStorage.getItem(CONFIG.DOWNLOAD_URL);
          if( baseUrl != null && baseUrl.length > 0 ){
            this.cy.nodes(`[label='${label.name}']`).forEach(e => {
              e._private.scratch._style['image'] = fileItem.name;
              e.style('background-image', baseUrl+fileItem.name);
            });
          }
          else console.log('ERROR: background-image does not working because DOWNLOAD_URL is empty');
        }
      },
      err => {
        // error message
        this._api.setResponses(<IResponseDto>{ group: 'label-style', state: 'ERROR', 
            message: 'upload FAIL!!: '+JSON.stringify(err) });
        this.imageSelector.nativeElement.value = '';
      },
      () => {
        this._api.setResponses(<IResponseDto>{ group: 'label-style', state: 'SUCCESS', 
            message: 'upload completed!: '+fileItem.name });
        // **NOTE: 동일한 파일 선택시 input value 가 변하지 않아 event trigger가 발생하지 않는다
        //  ==> 초기화 해주어야 함 (참고 https://stackoverflow.com/a/30357800/6811653)
        this.imageSelector.nativeElement.value = '';
      }
    );
  }
  
  // Style: Visibility
  onChangeStyleVisible(event){
    // console.log( 'onChangeStyleVisible:', event.checked );
    this.selectedLabel.scratch._style.visible = event.checked;
    let targets = this.cy.elements(`${this.selectedLabel.type == 'nodes' ? 'node' : 'edge'}[label='${this.selectedLabel.name}']`);
    targets.forEach(x => {
      x._private.scratch._style.visible = event.checked;
    });
    // node 라면 connectedEdge 들도 visible=false 가 되어야 함
    if( this.selectedLabel.type == 'nodes' ){
      targets.connectedEdges().forEach(x => {
        x._private.scratch._style.visible = event.checked;
      });
    }
    this.cy.style().update();
  }
  // Style: Color
  onChangeStyleColor(value:number){
    // console.log( 'onChangeStyleColor:', this.colorsPallet[value] );
    this.selectedLabel.scratch._style.color = this.colorsPallet[value];
    let targets = this.cy.elements(`${this.selectedLabel.type == 'nodes' ? 'node' : 'edge'}[label='${this.selectedLabel.name}']`);
    targets.forEach(x => {
      x._private.scratch._style.color = _.cloneDeep(this.colorsPallet[value]);
    });
    this.cy.style().update();
  }
  // Style: Width
  onChangeStyleWidth(event){
    // console.log( 'onChangeStyleWidth:', event.value );    // number type
    this.selectedLabel.scratch._style.width = event.value;
    let targets = this.cy.elements(`${this.selectedLabel.type == 'nodes' ? 'node' : 'edge'}[label='${this.selectedLabel.name}']`);
    targets.forEach(x => {
      x._private.scratch._style.width = event.value;
    });
    this.cy.style().update();
  }
  // Style: Label ==> Find Label로 탐색 가능
  onChangeStyleTitle(event){
    // console.log( 'onChangeStyleTitle:', event.value );    // property.key
    this.selectedLabel.scratch._style.title = (event.value == '_null_') ? undefined : event.value;
    let targets = this.cy.elements(`${this.selectedLabel.type == 'nodes' ? 'node' : 'edge'}[label='${this.selectedLabel.name}']`);
    targets.forEach(x => {
      x._private.scratch._style.title = (event.value == '_null_') ? undefined : event.value;
    });
    this.cy.style().update();
  }

  /////////////////////////////////////////////////////////////////
  // Canvas Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback(e):void {
    this.selectedElement = undefined;
    this.selectedLabel = undefined;

    let currentTapStamp = e.timeStamp;
    let msFromLastTap = currentTapStamp - this.cyPreviousTapStamp;

    if (msFromLastTap < this.cyDoubleClickDelayMs) {
        e.target.trigger('doubleTap', e);
    }
    this.cyPreviousTapStamp = currentTapStamp;    
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    console.log('target:', target._private);
    // null 이 아니면 정보창 (infoBox) 출력
    if( this.btnStatus.shortestPath ) this.selectFindShortestPath(target);
    else if( this.btnStatus.neighbors ) this.highlightNeighbors(target);
    else if( this.btnStatus.editMode ) this.openSheetEditElement(target.json());
    else{
      let allStatus = Object.keys(this.btnStatus).reduce((prev,key) => {
        if( key == 'overlayGraph' ) return prev;      // 예외: overlay 에서도 정보창 이용 가능하도록
        return <boolean>prev || this.btnStatus[key];
      }, false );

      if( !allStatus && !target.isParent() ){         // parent 는 정보창 출력 대상에서 제외
          this.selectedElement = target;
        let selected = this.cy.elements(':selected').filter(x => x != target );
        // edge 일 경우, 연결된 nodes 까지 선택
        if( target.group() == 'edges' ){
          let sourceV = target.source().select();
          let targetV = target.target().select();
          selected = selected.filter(x => x != sourceV && x != targetV );
        } 
        // **NOTE : click 에 의한 multi-selection 방지. But, shift 키 사용시 계속 선택
        if( !this.withShiftKey) {
          Promise.resolve(null).then(()=>{
            selected.unselect();
          });
        }
      }
    }
  }  

  // qtipMenu 선택 이벤트
  qtipEleMenu( action, targets ){
    console.log( 'qtipEleMenu:', action, targets );

  }

  // qtipMenu 선택 이벤트
  qtipCxtMenu( action ){
    console.log( 'qtipCxtMenu:', action, this.cy.scratch('_position') );
    let targets = this.cy.nodes(':selected');
    let target = targets.empty() ? undefined : targets.first();

    switch( action )    {
      case 'selectAll': 
              this.cy.elements(':visible').select(); break;
      case 'showAll': 
              this.cy.elements(':hidden').style('visibility','visible'); break;
      case 'toggleSelection': 
              let selected = this.cy.elements(':selected');
              let unselected = this.cy.elements(':unselected');                
              this.ur.do('batch', [{name: 'select', param: unselected}, {name: 'unselect', param: selected}]);
              break;
      // case 'makeInvisible': 
      //         if( targets.nonempty() ) this.ur.do('invisible', targets); 
      //         break;
      case 'grouping': 
              if( targets.size() > 1 ) this.ur.do('grouping', targets); 
              break;
      case 'degrouping': 
              if( target && target.isParent() ) this.ur.do('degrouping', target); 
              break;
      case 'copy': 
              if( targets.nonempty() ) this.ur.do('copy', targets);
              break;
      case 'cut': 
              if( targets.nonempty() ) this.ur.do('cut', targets);
              break;
      case 'paste': 
              if( targets.nonempty() ) this.ur.do('paste', targets);
              break;
      case 'remove': 
              if( targets.nonempty() ) this.ur.do('delete', targets);
              break;
    }
  }
  

  /////////////////////////////////////////////////////////////////
  // Graph Controllers
  /////////////////////////////////////////////////////////////////

  // for banana javascript, have to use 'document.querySelector(...)'
  toggleProgressBar(option:boolean = undefined){
    let graphProgressBar:any = document.querySelector('div#progressBarQueryGraph');
    if( !graphProgressBar ) return;

    if( option === undefined ) option = !((graphProgressBar.style.visibility == 'visible') ? true : false);
    // toggle progressBar's visibility
    if( option ) graphProgressBar.style.visibility = 'visible';
    else graphProgressBar.style.visibility = 'hidden';
    this._cd.detectChanges();
  } 

  // 결과들만 삭제 : runQuery 할 때 사용
  clear(option:boolean=true){
    // 그래프 비우고
    this.cy.elements().remove();
    // 그래프 라벨 칩리스트 비우고, gid도 초기화
    if( option ) { this.labels = []; this.gid = -1; }
    this.selectedElement = undefined;
    this.timeoutNodeEvent = undefined;
    // 그래프 관련 콘트롤러들 초기화
    Object.keys(this.btnStatus).map( key => this.btnStatus[key] = false );
  }

  setGid( gid: number ){ 
    if( gid > 0 ) this.gid = gid; 
  }
  addLabel( label:ILabel ){ 
    let arr = this.labels.map(x => x.id);
    if( arr.indexOf(label.id) == -1 ) this.labels.push( label );  // not exists
  }
  addNode( ele:INode ){ 
    let target = this.cy.getElementById(ele.data.id);
    if( target.empty() ){   // not exists
      target = this.cy.add( ele );
    }
  }
  addEdge( ele:IEdge ){ 
    let target = this.cy.getElementById(ele.data.id);
    if( target.empty() ){   // not exists
      target = this.cy.add( ele );
    }
  }

  // 데이터 불러오고 최초 적용되는 작업들 
  initCanvas( isTempGraph:boolean = false ){
    if( this.cy.$api.view ) this.cy.$api.view.removeHighlights();
    this.cy.elements(':selected').unselect();
    
    this.isTempGraph = isTempGraph;
    this.cy.style(agens.graph.stylelist['dark']).update();

    // 완료 상태를 상위 graph.component 에 알려주기 (& layout 적용)
    this.initDone.emit(this.isVisible);
  }

  // 액티브 상태가 될 때마다 실행되는 작업들
  refreshCanvas(){   
    this.cy.resize();
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.fit( this.cy.elements(), 50);
    agens.cy = this.cy;
  }

  adjustMenuOnNode(labels: Array<ILabel>, collection:any ){

  }

  clickGraphLabelChip( label:ILabel ): void {
    this.selectedElement = undefined;
    this.cy.elements(':selected').unselect();

    this.selectedLabel = label;
    setTimeout(()=>{
      // Load with default options

      // select elements with selected label
      let group = (label.type == 'edges') ? 'edge' : 'node';
      this.cy.elements(`${group}[label='${label.name}']`).select();
    }, 20);
    // console.log('clickGraphLabelChip:', this.selectedLabel.scratch._style);
    this._cd.detectChanges();
  }

  savePositions(){
    // 저장할 꺼리가 있으면 저장 
    if( this.gid > 0 && this.cy.nodes().size() > 0 ) this._util.savePositions( this.cy );
  }

  graphPresetLayout(){
    // ///////////////////////////////////////////////////
    // **NOTE: 레이아웃 적용시 가끔 StackOverflow 발생
    //  ==> 문제 해결때 까지 주석처리함 (2018-09-18)
    //  ==> setTimeout 으로 layout() 을 감싸주니 괜찮음. 다시 해제함 (2018-09-27)

    if( this._util.hasPositions() ){
      this.toggleProgressBar(true);
      let remains:any[] = this._util.loadPositions(this.cy);

      let animation_enabled = localStorage.getItem(CONFIG.ANIMATION_ENABLED_KEY);
      let layoutOption = {
        name: 'random',
        fit: false, padding: 50, boundingBox: undefined, 
        nodeDimensionsIncludeLabels: true, randomize: false,
        animate: animation_enabled == 'true' ? 'end' : false, 
        refresh: 30, animationDuration: 800, maxSimulationTime: 2800,
        ready: () => {}, stop: () => { this.cy.fit( this.cy.elements(), 50); this.toggleProgressBar(false); }
      };
      // rest random layout
      let elements = this.cy.nodes().filter(x => remains.includes(x.id()));           
      setTimeout(()=>{
        elements.layout(layoutOption).run();     
      }, 10);
    }
    else{
      this.graphChangeLayout('random');
    }
  }

  // cytoscape makeLayout & run
  graphChangeLayout(layout:string){
    this.toggleProgressBar(true);
    let targets = this.cy.elements(':selected');
    this.cy.$api.changeLayout(layout, {
      "padding": 50      
      , "elements": (targets.size() > 2) ? targets : undefined
      , "boundingBox": (targets.size() > 2) ? targets.boundingBox() : undefined
      , "ready": () => { }
      , "stop": () => { this.toggleProgressBar(false); }
      , "animate": localStorage.getItem(CONFIG.ANIMATION_ENABLED_KEY)
    });
  }

  /////////////////////////////////////////////////////////////////
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  selectedLockToggle(target:any){
    if( target.locked() ) target.unlock();
    else target.lock();
  }

  // toggleMouseWheelZoom(checked?:boolean): void{
  //   if( checked === undefined ) this.btnMouseWheelZoom.checked = !this.btnMouseWheelZoom.checked;
  //   else this.btnMouseWheelZoom.checked = checked;

  //   // graph의 userZoomingEnabled 설정 변경
  //   this.cy.userZoomingEnabled( this.btnMouseWheelZoom.checked ); 
  //   this.btnStatus.mouseWheel = this.btnMouseWheelZoom.checked;
  // }

  focusAllItems(){
    if( this.labelSearchItems.length == 0 ) return;
    let elements = this.cy.collection();
    this.labelSearchItems.forEach(x => {
      elements = elements.add(this.cy.getElementById(x["id"]));
    });
    console.log("focustAll:", elements);
    setTimeout(() => { if( !elements.empty() ) this.cy.$api.view.highlight( elements )}, 10);
  }
  focusSearchedLabel(item:any){
    let element = this.cy.getElementById(item["id"]);
    if( !element.empty() ){
      this.cy.$api.view.removeHighlights();
    }
    console.log( 'focusLabel', element );
    setTimeout(() => { if( !element.empty() ) this.cy.$api.view.highlight( element )}, 10);
  }

  updateFilterTitle($event){
    const kwd = $event.target.value.toLowerCase();
    this.cy.$api.view.removeHighlights();

    // filter our data
    const elements = this.cy.nodes().filter(x => {
      const title = x.style('label');
      return title.toLowerCase().indexOf(kwd) > -1;
    });
    this.labelSearchCount = elements.size();
    this.labelSearchItems = elements.map(x => {
      return { "id": x.id(), "title": x.style('label') };
    });
    // console.log('updateFilterLabel', kwd, elements);
    setTimeout(() => { if( !elements.empty() ) this.cy.$api.view.highlight( elements )}, 10);
  }

  toggleShowHideTitle(checked?:boolean): void{
    if( checked === undefined ) this.btnShowHideTitle.checked = !this.btnShowHideTitle.checked;
    else this.btnShowHideTitle.checked = checked;
    this.btnStatus.showHideTitle = this.btnShowHideTitle.checked;

    // 선택옵션 설정
    if( this.btnShowHideTitle.checked ){
      this.selectedOption = 'labelSearch';
      this.labelSearchCount = 0;
      this.labelSearchItems = [];
    } 
    else{
      this.selectedOption = undefined;
    } 

    // graph의 userZoomingEnabled 설정 변경
    this.cy.scratch('_config').hideNodeTitle = !this.btnShowHideTitle.checked;
    this.cy.style(agens.graph.stylelist['dark']).update();
  }

  toggleHighlightNeighbors(checked?:boolean): void{
    if( checked === undefined ) this.btnHighlightNeighbors.checked = !this.btnHighlightNeighbors.checked;
    else this.btnHighlightNeighbors.checked = checked;

    this.btnStatus.neighbors = this.btnHighlightNeighbors.checked;
  }

  highlightNeighbors(target){
    // neighbors select
    let neighbors = this.cy.$api.findNeighbors(target, [], 3);
    this.cy.$api.view.highlight(neighbors);
    let edges = neighbors.edgesWith(neighbors); // inter-connected edges
    console.log( 'highlightNeighbors:', edges);
    this.cy.$api.view.highlight(edges);
    Promise.resolve(null).then(() => { 
      neighbors.select(); 
    });
  }

  /////////////////////////////////////////////////////////////////
  // Edit Sheet : Label, Properties of element
  /////////////////////////////////////////////////////////////////

  openSheetEditElement(element:any=undefined, callback:Function=undefined): void {
    if( !element ) return;

    const bottomSheetRef = this._sheet.open(EditGraphComponent, {
      ariaLabel: 'Edit element',
      panelClass: 'sheet-edit-graph',
      data: { "gid": this.gid, "labels": this.labels, "element": element }
    });

    bottomSheetRef.afterDismissed().subscribe((x) => {
      if( callback ) (callback)();
      if( !x ) return;
      // element.json() 의 내용이 변경된 경우 cy.element 내부 데이터도 연결되어 변경됨
      // ==> Server TP3 에 반영되면 됨
      if( x.created ){
        this.ur.do( "create", x.element );
      }

      // change Detection by force
      this._cd.detectChanges();
    });
  }

  /////////////////////////////////////////////////////////////////
  // FilterNGroupSheet
  /////////////////////////////////////////////////////////////////

  openFilterNGroupSheet(): void {
    // if( !this.metaGraph ) return;

    this.btnStatus.metaGraph = true;
    const bottomSheetRef = this._sheet.open(MetaGraphComponent, {
      ariaLabel: 'Meta Graph',
      panelClass: 'sheet-meta-graph',
      data: { "gid": this.gid, "labels": this.labels }
    });

    bottomSheetRef.afterDismissed().subscribe((x) => {
      this.btnStatus.metaGraph = false;
      agens.cy = this.cy;
      // 변경된 meta에 대해 data reload
      if( x && (x.hasOwnProperty('filters') && x.hasOwnProperty('groups'))
          && (Object.keys(x['filters']).length > 0 || Object.keys(x['groups']).length > 0) ) 
        this.runFilterByGroupBy(x);

      // change Detection by force
      this._cd.detectChanges();
    });
  }

  /////////////////////////////////////////////////////////////////
  // Toolbar controllers : centrality
  /////////////////////////////////////////////////////////////////

  // _style의 width 데이터를 직접 수정, 원복시 _styleBak를 복사
  graphCentrality(option:string='degree'){ 
    // options: degree, pagerank, closeness, betweenness
    switch( option ){
      case 'degree': this._graph.centralrityDg( this.cy );      break;
      case 'pagerank': this._graph.centralrityPR( this.cy );    break;
      case 'closeness': this._graph.centralrityCn( this.cy );   break;
      case 'betweenness': this._graph.centralrityBt(this.cy );  break;
      case 'byValue':                                           // by property's value
            this.btnStatus.valueCentrality = true;
            this.initCentrality();
            break;
      default:                                                  // restore original style
        this.cy.elements().forEach(e => {
          e._private.scratch._style.width = e._private.scratch._styleBak.width;
        });
    }

    this.cy.style(agens.graph.stylelist['dark']).update();
  }

  initCentrality(){
    this.timelineDisabled = true;
    if( this.labels.length > 0 ){
      let property:IProperty = (this.labels[0].properties && this.labels[0].properties.length > 0) ?
              this.labels[0].properties[0] : undefined;
      this.timelineLabelCtl = new FormControl(this.labels[0], []);
      this.timelinePropertyCtl = new FormControl( property, [] );
      this.timelineSampleCtl = new FormControl( property.type, [] );
      if( ['STRING', 'BOOLEAN', 'NUMBER'].includes(property.type) ) this.timelineDisabled = false;
    }
    else{
      this.timelineLabelCtl = new FormControl( {value: { name: "" }, disabled: true} , []);
      this.timelinePropertyCtl = new FormControl( {value: { key: "" }, disabled: true}, [] );
      this.timelineSampleCtl = new FormControl( '', [] );
    }
  }

  onChangeCentralityProperty(event){
    let property = <IProperty>event.value;
    if( ['STRING', 'BOOLEAN', 'NUMBER'].includes(property.type) ) this.timelineDisabled = false;
    else this.timelineDisabled = true;
    this.timelineSampleCtl.setValue(property.type);
    this._cd.detectChanges();
  }

  doByValueCentrality(){
    this._api.grph_propStat(this.gid, this.timelineLabelCtl.value.type, this.timelineLabelCtl.value.name, this.timelinePropertyCtl.value['key'])
    .subscribe(
      x => {
        if( x.state == 'SUCCESS' ){
          this._graph.centralrityValue(this.cy, this.timelineLabelCtl.value.type, x);
        }
        this._api.setResponses(<IResponseDto>{
          group: x.group, state: x.state, message: x.message
        });
      }
    );
  }

  /////////////////////////////////////////////////////////////////
  // graph Toolbar button controlls
  /////////////////////////////////////////////////////////////////

  clearFindShortestPath(){
    this.shortestPathOptions = { sid: undefined, eid: undefined, directed: false, order: 0, distTo: undefined };
    // cancel selected and highlights
    if( this.cy.$api.view ) this.cy.$api.view.removeHighlights();
    this.cy.elements(':selected').unselect();

    this._cd.detectChanges();
  }

  toggleFindShortestPath(option:boolean=undefined){
    if( !option ) this.btnStatus.shortestPath = !this.btnStatus.shortestPath;
    else this.btnStatus.shortestPath = option;

    // enable 모드이면 options 리셋
    if( this.btnStatus.shortestPath ){
      this.shortestPathOptions = { sid: undefined, eid: undefined, directed: false, order: 0, distTo: undefined };
    }
    this._cd.detectChanges();
  }

  selectFindShortestPath(target:any){
    this.cy.elements(':selected').unselect();
    if( target.isNode() ){
      this.shortestPathOptions.order += 1;
      if( this.shortestPathOptions.order % 2 == 1 ){
        this.shortestPathOptions.sid = target.id();
        this.shortestPathOptions.eid = undefined;
        setTimeout(() => {         
          this.cy.nodes(`#${this.shortestPathOptions.sid}`).select();
        }, 30);
      } 
      else {
        this.shortestPathOptions.eid = target.id();
        setTimeout(() => {         
          this.cy.nodes(`#${this.shortestPathOptions.sid}, #${this.shortestPathOptions.eid}`).select();
        }, 30);
      }
    }
  }

  doFindShortestPath(directed:boolean=false){
    this.cy.elements(':selected').unselect();

    let dijkstra = this.cy.elements().dijkstra(
      this.cy.getElementById(this.shortestPathOptions.sid)
      , function(edge){ return !edge.data('weight') ? 1 : edge.data('weight'); }
      , this.slideSPathDirected.checked );
    
    let pathTo = dijkstra.pathTo( this.cy.getElementById(this.shortestPathOptions.eid) );
    if( !pathTo.empty() ){
      this.shortestPathOptions.distTo = dijkstra.distanceTo( this.cy.getElementById(this.shortestPathOptions.eid) );
      this.cy.$api.view.highlight(pathTo);
      pathTo.select();
    }
  }

  toggleFindConnectedGroup(option:boolean=undefined){
    if( !option ) this.btnStatus.connectedGroup = !this.btnStatus.connectedGroup;
    else this.btnStatus.connectedGroup = option;

    // enable 모드이면 start_id, end_id 리셋
    if( this.btnStatus.connectedGroup ) {
      let groups:any[] = this.cy.elements(':visible').components();
      groups.forEach((grp,idx) => {
        this.cy.$api.grouping(grp.nodes(), undefined, 'group#'+idx);
      });
    }
    else {
      let parents:any = this.cy.nodes().parent();
      parents.forEach(target => {
        this.cy.$api.degrouping(target);
      });
    }
  }

  toggleFindCycles(option:boolean=undefined){
    if( !option ) this.btnStatus.findCycles = !this.btnStatus.findCycles;
    else this.btnStatus.findCycles = option;

    // enable 모드이면 start_id, end_id 리셋
    if( this.btnStatus.findCycles ) {
      this.grph_data = [];
      this._api.graph_findCycles(this.gid).subscribe(
        (x:IDoubleListDto) => {
          if( x.result ) this.grph_data = x.result;
          this._cd.detectChanges();
        }
      )
    }
    else {
      this.grph_data = [];
    }
  }

  onClickCyclePath(i){
    this.cy.elements(':selected').unselect();
    if( this.grph_data.length == 0 ) return;

    let sid:string = undefined;
    for( const vid of this.grph_data[i] ){
      this.cy.getElementById(vid).select();
      if( sid ){
        this.cy.edges(`[source='${sid}'][target='${vid}']`).select();
      }
      sid = String(vid);
    }
  }

  /////////////////////////////////////////////////////////////////
  // Toolbar : Timeline controlls
  /////////////////////////////////////////////////////////////////

  toggleTimeline(option:boolean=undefined){
    if( !option ) this.btnStatus.timeLine = !this.btnStatus.timeLine;
    else this.btnStatus.timeLine = option;

    // enable 모드이면 start_id, end_id 리셋
    if( this.btnStatus.timeLine ) {
      // this.timeline_data = this.cy.nodes().map((ele) => {
      //   return ele.data('prop').hasOwnProperty('date') ? ele.data('prop')['date'] : null;
      // }).filter(x => !!x);
      // this.timeline_data = ['2018-01-01', '2018-02-01', '2018-03-01', '2018-04-01', '2018-05-01', '2018-06-01'];
      // jQuery("#timelineSlider").ionRangeSlider();
      
      this.initTimeline();
      Promise.resolve(null).then(()=>{ 
        this._cd.detectChanges();
      });
    }
    else {
      this.timeline_data = [];
    }
  }

  initTimeline(){
    this.timelineDisabled = true;
    if( this.labels.length > 0 ){
      let property:IProperty = (this.labels[0].properties && this.labels[0].properties.length > 0) ?
              this.labels[0].properties[0] : undefined;
      this.timelineLabelCtl = new FormControl(this.labels[0], []);
      this.timelinePropertyCtl = new FormControl( property, [] );
      this.timelineSampleCtl = new FormControl( 
              this.getTimelineSample( this.labels[0].name, property ), [] );
    }
    else{
      this.timelineLabelCtl = new FormControl( {value: { name: "" }, disabled: true} , []);
      this.timelinePropertyCtl = new FormControl( {value: { key: "" }, disabled: true}, [] );
      this.timelineSampleCtl = new FormControl( '', [] );
    }
    this.timelineFormatCtl = new FormControl( "YYYY-MM-DD", []);
    
    this.timeline_data = [];
  }
  onChangeTimelineFormat(value){
    let sample = this.getTimelineSample(this.timelineLabelCtl.value.name, this.timelinePropertyCtl.value);
    if( sample != '' && moment(sample, value, true ).isValid() )
      this.timelineDisabled = false;
    else this.timelineDisabled = true;
    this._cd.detectChanges();
  }  
  onChangeTimelineProperty(event){
    // console.log( 'onChangeTimelineProperty:', event.value );
    if( event.value.type != 'STRING' ) this.timelineFormatCtl.disable({onlySelf:true});
    else this.timelineFormatCtl.enable({onlySelf:false});

    let sample = this.getTimelineSample(this.timelineLabelCtl.value.name, this.timelinePropertyCtl.value);
    this.timelineSampleCtl.setValue( sample, {emitEvent: false} );

    if( sample != '' && moment(sample, this.timelineFormatCtl.value, true ).isValid() )
      this.timelineDisabled = false;
    else this.timelineDisabled = true;
    this._cd.detectChanges();
  }
  getTimelineSample(labelName, propKey): string{
    if( !labelName || !propKey ) return '';

    let eles = this.cy.elements().filter(e => {
      return e.data('label') == labelName;
    });
    if( eles.nonempty() ){
      let data = eles.map(e => { 
        return (e.data('props').hasOwnProperty( propKey.key )) 
                ? e.data('props')[ propKey.key ] : null; 
        }).filter(v => v != null);
      if( data.length > 0 ) return <string> data[0];
    }
    return '';
  }
  setTimelineData(){
    this.timeline_data = this.cy.nodes().map(e => { 
      return (e.data('props').hasOwnProperty( this.timelinePropertyCtl.value.key )) 
              ? e.data('props')[ this.timelinePropertyCtl.value.key ] : null; 
      }).filter(v => v != null);
  }
  
  onControlTimelineSlider(event) {
    if( !event ) return;

    if( event == 'play' ){
      this.cy.elements(':selected').unselect();
      this.cy.elements().style('opacity',0.25);
    }
    else if( event == 'stop' ){
      this.cy.elements(':selected').unselect();
      this.cy.elements().style('opacity',1.0);
    }
  }
  onChangeTimelineSlider(event) {    
    if( !event ) return;
    this.timelineSampleCtl.setValue(event);

    let labelName = this.timelineLabelCtl.value.name;
    let propKey = this.timelinePropertyCtl.value.key;
    let targets = this.cy.elements().filter(e => {
      return e.data('label') == labelName && e.data('props').hasOwnProperty(propKey)
              && e.data('props')[propKey] == event;
    });
    this.cy.elements(':selected').unselect();
    targets.select();

    let visibleElements = this.cy.collection();
    targets.forEach(e => {
      visibleElements = visibleElements.union(e);
      visibleElements = visibleElements.union( e.neighborhood() );
      visibleElements = visibleElements.union( visibleElements.neighborhood() );
      visibleElements = visibleElements.union( visibleElements.edgesWith(visibleElements) );
    });
    visibleElements.style('opacity',1.0);
    // visibleElements.animate({ style: { 'visibility': 'visible' }, duration: 500 });
    let restElements = this.cy.elements().difference( visibleElements );
    restElements.style('opacity',0.25);
    // restElements.animate({ style: { 'visibility': 'hidden' }, duration: 200 });
  }
  onUpdateTimelineSlider(event) {
    console.log("timelineSlider updated:", event);
    if( !event ) return;
  }
  setTimelineSliderValue( value ) {
    this.timelineSlider.update( value );
  }

  /////////////////////////////////////////////////////////////////
  // graph Toolbar button controlls
  /////////////////////////////////////////////////////////////////

  runFilterByGroupBy(options: any){

    this.toggleProgressBar(true);
    this._util.savePositions( this.cy );  // hashMap<id,any> 에 position 저장
    this.clear(false);                    // false: clear canvas except labels    

    // call API
    let data$:Observable<any> = this._api.grph_filterNgroupBy(this.gid, options);

    data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        // console.log(`graph_dto receiving : gid=${x.gid} (${this.gid})`);
      });
    data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        this.tempGraph = x;
        this.tempGraph.labels = new Array<ILabel>();
        this.tempGraph.nodes = new Array<INode>();
        this.tempGraph.edges = new Array<IEdge>();    
      });
    data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        this.labels
        .filter(val => val.id == x.id)
        .map(label => {
          x.scratch['_style'] = _.cloneDeep( label.scratch['_style'] );
        });
        this.tempGraph.labels.push( x );
      });
    data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
      // setNeighbors from this.resultGraph.labels;
      x.scratch['_neighbors'] = new Array<string>();
      this.labels
        .filter(val => val.type == 'nodes' && val.name == x.data['label'])
        .map(label => {
          x.scratch['_neighbors'] += label.targets;
          x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
      // x['position'] = this._util.getPositionById(x.data.id);
      this.tempGraph.nodes.push( x );
      this.addNode( x );
      });
    data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.labels
        .filter(val => val.type == 'edges' && val.name == x.data['label'])
        .map(label => {
          x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
      this.tempGraph.edges.push( x );
      this.addEdge( x );
      });
    data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        this.recountingLabels();
        this.initCanvas( true );
        this.toggleProgressBar(false);
      });
  }
  
  // filterNgroup 등의 동작으로 element 개수가 달라진 경우 사용
  // ** NOTE: 바꿔치기 하지 말것!! (스타일 정보 등의 정합성 유지)
  recountingLabels(){
    this.labels.forEach(x => {
      let targets = (x.type == 'nodes') ? 
                    this.cy.nodes(`[label='${x.name}']`) : this.cy.edges(`[label='${x.name}']`);
      x.size = targets.length;
    });
  }

  reloadGraph(){
    if( this.gid < 0 ) return;
    this.toggleProgressBar(true);
    this._util.savePositions( this.cy );        // hashMap<id,any> 에 position 저장

    this.clear(false);   // false: clear canvas except labels    

    // call API
    let data$:Observable<any> = this._api.grph_graph(this.gid);

    data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        console.log(`graph_dto receiving : gid=${x.gid} (${this.gid})`);
      });
    data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        this.dataGraph = x;
        this.dataGraph.labels = new Array<ILabel>();
        this.dataGraph.nodes = new Array<INode>();
        this.dataGraph.edges = new Array<IEdge>();    
      });
    data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        this.labels
        .filter(val => val.id == x.id)
        .map(label => {
          x.scratch['_style'] = _.cloneDeep( label.scratch['_style'] );
        });
        this.dataGraph.labels.push( x );
      });
    data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
      // setNeighbors from this.resultGraph.labels;
      x.scratch['_neighbors'] = new Array<string>();
      this.labels
        .filter(val => val.type == 'nodes' && val.name == x.data['label'])
        .map(label => {
          x.scratch['_neighbors'] += label.targets;
          x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
      x['position'] = this._util.getPositionById(x.data.id);
      this.dataGraph.nodes.push( x );
      this.addNode( x );
      });
    data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.labels
        .filter(val => val.type == 'edges' && val.name == x.data['label'])
        .map(label => {
          x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
      this.dataGraph.edges.push( x );
      this.addEdge( x );
      });
    data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        this.recountingLabels();
        this.initCanvas( false );
        this.toggleProgressBar(false);
      });    
  }

  /////////////////////////////////////////////////////////////////
  // Image Export : PNG
  /////////////////////////////////////////////////////////////////
  
  openImageExportDialog(){
    // recordTable에 결과가 없어도 graph 에 출력할 내용물이 있으면 OK!
    if( this.cy.elements(':visible').length === 0 ) return;
    
    let dialogRef = this._dialog.open(ImageExportDialog, {
      width: 'auto', height: 'auto',
      data: this.cy
    });

    dialogRef.afterClosed().subscribe(result => {
      if( result === null ) return;
      // agens.graph.exportImage 호출
      agens.graph.exportImage( result.filename, result.watermark );
    });
  }

  /////////////////////////////////////////////////////////////////
  // Label Style Setting Controllers
  /////////////////////////////////////////////////////////////////
  
  toggleOverlayGraph(option:boolean=undefined){
    if( !option ) this.btnStatus.overlayGraph = !this.btnStatus.overlayGraph;
    else this.btnStatus.overlayGraph = option;

    // overlay Graph 가 선택되면, IGraph 데이터를 받아 Canvas 상에 표시
    // 1) node 가 몇개 매칭되는지 표시 되어야 하고 (project Sheet 상에서 임시로 매칭??)
    // 2) <id> => clone_<id> 등으로 변경되어 add 되어야 함 (동일 id 존재 불가능)
    // 3) 존재하는 node 의 position 가져오고 , 없는 것들은 layout 적용
    // 4) grouping 시킨다

    if( this.btnStatus.overlayGraph ) {
      this.openOverlayGraphSheet();

      Promise.resolve(null).then(()=>{ 
        this._cd.detectChanges();
      });
    }

    // overlay Graph 해제시, 존재하는 overlay Box 들 등을 모두 remove
    else {
      // this.ur.do('remove', this.cy.elements('.overlay'));
      this.cy.elements('.overlay').remove();
      this.cy.nodes(':locked').unlock();
    }

  }

  openOverlayGraphSheet(): void {

    // id list
    let ids = this.cy.nodes(':visible').map(x => x.id());

    // get center position
    let extent = (this.cy.nodes().size() > 0 ) ? this.cy.nodes().boundingBox() : undefined;
    let center = ( extent ) ? { x: (extent.x2+extent.x1)/2, y: (extent.y2+extent.y1)/2 } : undefined;

    const bottomSheetRef = this._sheet.open(OverlayGraphComponent, {
      ariaLabel: 'Overlay Graph',
      panelClass: 'sheet-meta-graph',
      data: { "ids": ids, "labels": this.labels, "center": center }
    });

    bottomSheetRef.afterDismissed().subscribe((x:IGraph) => {

      agens.cy = this.cy;
      if( !x ) return;

      // 혹시 기존에 overlay graph 가 있다면 제거
      this.cy.batch(()=>{
        this.cy.elements('.overlay').remove();
        let exact_matched:string[] = [];     // 완전 매치
        let half_matched:string[] = [];      // 부분 매치 : same direction, same label

        // 새로운 overlay graph 붙이기
        // ** match 전략
        // 1) 같은 ID 의 node 에 대해 동일 position 부여 (최우선)
        // 2) matched node list 순회
        //    - same direction, same label ==> half match
        x.nodes.forEach(e => {
          let match = this.cy.getElementById(e.scratch['_id']);
          if( match.size() > 0 ){
            e.position = _.clone( match.position() );   // 동일 ID
            match.lock();                               // lock
            exact_matched.push( match.id() );           // exact_matched 추가
            e.classes += ' exact_match';                // marking overlay matched node
          } 
          this.cy.add( e );
        });

        x.edges.forEach(e => {
          let isMatched = false;
          // if sourceV is matched and targetV is not matched
          if( exact_matched.includes( e.scratch['_source'] ) && !exact_matched.includes( e.scratch['_target'] ) ){
            // overlay 매칭 대상
            let target = this.cy.getElementById(e.data['target']);
            // original 매칭 후보들                                                                                       
            let candidates = this.cy.getElementById(e.scratch['_source']).outgoers().targets();
            // half matching : same label and not used for matching
            isMatched = isMatched || this.overlayHalfMatching( target, candidates, half_matched );
          }
          // if sourceV is not matched and targetV is matched
          if( !exact_matched.includes( e.scratch['_source'] ) && exact_matched.includes( e.scratch['_target'] ) ){
            // overlay 매칭 대상
            let target = this.cy.getElementById(e.data['source']);
            // original 매칭 후보들                                                                                       
            let candidates = this.cy.getElementById(e.scratch['_target']).incomers().sources();
            // half matching : same label and not used for matching
            isMatched = isMatched || this.overlayHalfMatching( target, candidates, half_matched );
          }
          if( isMatched ) e.classes += ' half_match';    // 사용된 edge 에도 match 표식
          this.cy.add( e );
        });

        this.cy.fit( this.cy.elements(), 50);
      });

      // change Detection by force
      this._cd.detectChanges();
    });
  }

  private overlayHalfMatching(target:any, candidates:any, half_matched:string[] ){
    let isMatched = false;
    if( target.size() > 0 && candidates.size() > 0 ){
      // 부분매칭 조건 : same label
      candidates = candidates.filter(y => y.data('label') == target.data('label') );
      if( candidates.size() > 0 ){
        isMatched = true;
        let matches = candidates.filter(y => !half_matched.includes( y.id() ) );
        if( matches.size() > 0 ){    // 선정 : matches.first()                
          let ele = matches.first();
          half_matched.push( ele.id() );          // half_matched 추가                
          target.scratch('_match', ele.id());
          target.position( _.clone(ele.position()) );
          // 이후에 class 제어하려면 이렇게 ==> overlay._private.classes.add('new',1);
          target.addClass('half_match');
        }
      }
    }
    return isMatched;
  }
}
