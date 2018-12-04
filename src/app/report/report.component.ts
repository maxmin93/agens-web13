import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { ViewChild, ElementRef, ChangeDetectorRef, NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

import { MatSnackBar } from '@angular/material';

import { Observable, Subject, Subscription, interval, of } from 'rxjs';
import { tap, map, filter, concatAll, share, takeWhile, timeout, catchError } from 'rxjs/operators';

import { AgensDataService } from '../services/agens-data.service';

import { IResultDto, IResponseDto, IGraphDto } from '../models/agens-response-types';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle, IRecord, IColumn, IRow, IEnd } from '../models/agens-data-types';
import { IProject } from '../models/agens-manager-types';

import * as _ from 'lodash';
import * as moment from 'moment';

import * as CONFIG from '../app.config';

declare var agens : any;
declare var jQuery: any;

@Component({
  selector: 'app-report',
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.scss'],
  host: {
    '(document:keyup)': 'handleKeyUpEvent($event)',
    '(document:keydown)': 'handleKeyDownEvent($event)'
  }  
})
export class ReportComponent implements OnInit, AfterViewInit, OnDestroy {

  // initialization
  title = 'AgensBrowser Report';
  isLoading:boolean = true;
  private handler_param: Subscription;
  private todo$:Subject<any> = new Subject();

  // AgensBrowser API
  private pid: number;
  private guestKey: string;
  private handlers: Subscription[] = [ undefined, undefined, undefined, undefined, undefined, undefined ];
  private projectDto: IGraphDto = undefined;
  projectGraph: IGraph = undefined;
  currProject: IProject =  <IProject>{
    id: null,
    title: '',
    description: '',
    sql: '',
    graph: null,
    image: null
  };

  // progresss-circle
  timer_max = 1.0;
  timer_curr = 0;
  handler_timer:Subscription;

  // key event : double-click
  canvasHover: boolean = false;
  withShiftKey: boolean = false;
  private cyDoubleClickDelayMs = 350;
  private cyPreviousTapStamp;

  // canvas
  gid: number = undefined;
  cy: any = undefined;      // for Graph canvas
  ur: any = undefined;      // cy undoRedo
  selectedElement: any = undefined;  

  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;

  constructor(
    private _ngZone: NgZone,
    private _path: ActivatedRoute,
    private _router: Router,
    private _cd: ChangeDetectorRef,
    private _api: AgensDataService,
    public _snackBar: MatSnackBar
  ) { 
  }

  ngOnInit(){
    this.handler_param = this._path.params.subscribe(params => {
      this.guestKey = params['guestKey'];   // guestKey is defined at agens-config.yml
      this.pid = +params['pid'];            // (+) converts string 'id' to a number
      this.clear();
      // In a real app: dispatch action to load the details here.
      this.getReport(this.pid, this.guestKey);
    });

    // get return url from route parameters or default to '/'
    // this.returnUrl = this._route.snapshot.queryParams['returnUrl'] || '/';

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

  ngAfterViewInit(){
    let spinner$:Observable<number> = interval(100);
    this.handler_timer = spinner$.pipe(
      takeWhile(_ => this.isLoading && this.timer_curr < this.timer_max ),
      tap(i => this.timer_curr += 0.1)
    )
    .subscribe(
      x => {},
      err => {},
      () => {
        // 여전히 로딩 중이라면.. 이제 그만
        if( this.isLoading ){
          this.isLoading = false;
          agens.cy = this.cy;
          setTimeout(() => { this.cy.resize(); }, 100);
        }
      }
    );

    // cy events : click
    this.cy.on('tap', (e) => { 
      if( e.target === this.cy ) this.cyCanvasCallback(e);
      else if( e.target.isNode() || e.target.isEdge() ) this.cyElemCallback(e.target);

      // change Detection by force
      this._cd.detectChanges();
    });

    // only canvas trigger doubleTap event
    this.cy.on('doubleTap', (e, originalTapEvent) => {
      if( originalTapEvent.position ){
        // undefined => new node
        let target:any = { group: 'nodes', data: { id: agens.graph.makeid(), label: '', props: {}, size: 1 }
              , position: originalTapEvent.position, classes: "new" };
      }
    });    

    // cy undoRedo initialization
    this.ur = this.initUndoRedo(this.cy, this.gid);

    Promise.resolve(null).then(() => {
      // Cytoscape 바탕화면 qTip menu
      let tooltip = this.cy.qtip({
        content: jQuery('#divCxtMenu').html(),
        show: { event: 'cxttap', cyBgOnly: false /* true */ },    // cyBgOnly : element 위에서는 작동 안되게 할 것인지
        hide: { event: 'click unfocus' },
        position: { target: 'mouse', adjust: { mouse: false } },
        style: { classes: 'qtip-bootstrap', tip: { width: 16, height: 8 } },
        events: { visible: (event, api) => { jQuery('.qtip').click(() => { jQuery('.qtip').hide(); }); }}
      });
    });
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
      else if( charCode == "c" ) this.ur.do('copy', this.cy.elements(":selected"));
      else if( charCode == "x" ) this.ur.do('cut', this.cy.elements(":selected"));
      else if( charCode == "v" ) this.ur.do('paste');
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
  // clear, getData : Main functions
  /////////////////////////////////////////////////////////////////

  ngOnDestroy(){
    if( this.handler_param ){
      this.handler_param.unsubscribe();
      this.handler_param = undefined;
    }
    this.clearSubscriptions();
  }

  clearSubscriptions(){
    this.handlers.forEach(x => {
      if( x ) x.unsubscribe();
      x = undefined;
    });
  }

  clear(option:boolean=true){
    this.isLoading = true;
    if( this.cy ) this.cy.elements().remove();
    // 그래프 라벨 칩리스트 비우고, gid도 초기화
    if( option ) { this.projectGraph = undefined; this.gid = undefined; }
  }

  getReport(id:number, guestKey:string) {         

    // **NOTE: load 대상 graph 에 아직 gid 연결 안했음 (2018-10-12)
    let data$:Observable<any> = this._api.report_graph(id, guestKey);
    
    // load GraphDto to QueryGraph
    this.handlers[0] = data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        this.projectDto = x;
      },
      err => {
        console.log( 'project_load: ERROR=', err instanceof HttpErrorResponse, err.error );
        this._api.setResponses(<IResponseDto>{
          group: 'project::load',
          state: err.statusText,
          message: (err instanceof HttpErrorResponse) ? err.error.message : err.message
        });
        
        this.clearSubscriptions();
        // service is unavailable
        // this._router.navigate(['/login']);
      });

    /////////////////////////////////////////////////
    // Graph 에 표시될 내용은 누적해서 유지
    this.handlers[1] = data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        this.projectGraph = x;
        this.projectGraph.labels = new Array<ILabel>();
        this.projectGraph.nodes = new Array<INode>();
        this.projectGraph.edges = new Array<IEdge>();
      });
    this.handlers[2] = data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        this.projectGraph.labels.push( x );
      });
    this.handlers[3] = data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
        // setNeighbors from this.resultGraph.labels;
        x.scratch['_neighbors'] = new Array<string>();
        this.projectGraph.labels
          .filter(val => val.type == 'nodes' && val.name == x.data.label)
          .map(label => {
            x.scratch['_neighbors'] += label.targets;
          });
        this.projectGraph.nodes.push( x );
      });
    this.handlers[4] = data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.projectGraph.labels
          .filter(val => val.type == 'edges' && val.name == x.data.label)
          .map(label => {
          });   
        this.projectGraph.edges.push( x );  
      });     
    this.handlers[5] = data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        // console.log('END:', this.projectDto, this.projectGraph);
        this.isLoading = false;   
        this.initGraph(this.projectGraph);
        this.refreshCanvas();
      });    
  }

  initGraph(graph:IGraph){
    graph.labels.forEach(x => {
      let eles = (x.type == 'nodes') 
                ? graph.nodes.filter(y => y.data.label == x.name) 
                : graph.edges.filter(y => y.data.label == x.name);
      x.size = eles.length;     // update eles size of label
      if( eles.length > 0 ){
        if( eles[0].scratch.hasOwnProperty('_style') && eles[0].scratch['_style'] )
          x.scratch._style = _.cloneDeep(eles[0].scratch['_style']);
      }
    });
    // label 정렬 : node>edge 순으로, size 역순으로
    graph.labels = [... _.orderBy(graph.labels, ['type','size'], ['desc','desc'])];
    
    graph.nodes.forEach(e => {    
      let node = this.cy.add( e );
      // set node style of background-image
      if( e.scratch._style['image'] ){
        let baseUrl = localStorage.getItem(CONFIG.DOWNLOAD_URL);
        if( baseUrl != null && baseUrl.length > 0 )
          node.style('background-image', baseUrl+e.scratch._style['image']);
      }
    });
    graph.edges.forEach(e => {
      this.cy.add( e );
    });
  }

  /////////////////////////////////////////////////////////////////
  // Copy/Cut/Paste : 
  // ** gid 가 생성되지 않기 때문에 canvas 내에서만 이루어짐
  /////////////////////////////////////////////////////////////////

  /*
  updateGraph(oper:string, nodes:any[], edges:any[], callback:Function=undefined){
    let data:any = { gid: this.gid, graph: { labels: [],
      nodes: nodes.map(x => { 
        return { "group": 'nodes', "id": x.data.id, "label": x.data.label, "size": x.data.size, "props": x.data.props,
                  "name": x.data.hasOwnProperty('name') ? x.data.name : '' }; }),
      edges: edges.map(x => { 
        return { "group": 'nodes', "id": x.data.id, "label": x.data.label, "size": x.data.size, "props": x.data.props,
                  "source": x.data.source, "target": x.data.target, "name": x.data.hasOwnProperty('name') ? x.data.name : '' }; }),
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
  */

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
        // **NOTE: copy 대상이 아닌 edge 들이 덩달아 지워진것도 포함됨
        ur.clipboard['removed'] = eles.remove();
        return eles;
      },
      () => {              // undo Func
        // restore removed elements
        if( ur.clipboard['removed'] ){
          ur.clipboard['removed'].restore();
          ur.clipboard['removed'] = undefined;
        } 
      });

    ur.action('delete',    // actionName
      (eles:any) => {      // do Func
        ur.copy2cb(eles);
        // **NOTE: copy 대상이 아닌 edge 들이 덩달아 지워진것도 포함됨
        ur.clipboard['removed'] = eles.remove();        
      },
      () => {              // undo Func
        // restore removed elements
        if( ur.clipboard['removed'] ){
          ur.clipboard['removed'].restore();
          ur.clipboard['removed'] = undefined;
        } 
      });
    ur.action('create',
      (json:any) => {
        return this.cy.add( json );
      },
      (ele:any) => {
        return ele.remove();
      }
    );

    ur.action('paste',     // actionName
      () => {              // do Func
        let stack = ur.getUndoStack();
        if( stack.length < 1 || !['copy','cut','paste'].includes(stack[stack.length-1]['name']) ) return;
        if( !ur.clipboard['nodes'] || !ur.clipboard['edges'] ) return;        

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
      },
      () => {           // undo Func
        if( ur.clipboard['pasted'] ){
          ur.clipboard['pasted'].remove();
          ur.clipboard['pasted'] = undefined;
        } 
      });

    return ur;
  }

  /////////////////////////////////////////////////

  clickGraphLabelChip(target:ILabel){
    this.selectedElement = undefined;
    this.cy.elements(':selected').unselect();

    setTimeout(()=>{
      let group = (target.type == 'edges') ? 'edge' : 'node';
      this.cy.elements(`${group}[label='${target.name}']`).select();
    }, 20);
    this._cd.detectChanges();
  }

  toggleShowTitle(event){
    // console.log("toggle :", event.chekced);
    // graph의 hideNodeTitle 설정 변경
    this.cy.scratch('_config').hideNodeTitle = !event.checked;
    this.cy.style(agens.graph.stylelist['dark']).update();
  }

  /////////////////////////////////////////////////////////////////
  // Canvas Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback(e):void {
    this.selectedElement = undefined;
    let currentTapStamp = e.timeStamp;
    let msFromLastTap = currentTapStamp - this.cyPreviousTapStamp;

    if (msFromLastTap < this.cyDoubleClickDelayMs) {
        e.target.trigger('doubleTap', e);
    }
    this.cyPreviousTapStamp = currentTapStamp;    
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    // null 이 아니면 정보창 (infoBox) 출력
    this.selectedElement = target;
    if( !target.isParent() ){         // parent 는 정보창 출력 대상에서 제외
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
    // console.log('target:', this.cy.elements(':selected'), this.selectedElement._private);
  }  

  refreshCanvas(){
    agens.cy = this.cy;
    this.cy.resize();
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.fit( this.cy.elements(), 50);
  }

  // qtipMenu 선택 이벤트
  qtipCxtMenu( action ){
    // console.log( 'qtipCxtMenu:', action, this.cy.scratch('_position') );
    let targets = this.cy.nodes(':selected');
    let target = targets.empty() ? this.selectedElement : targets.first();

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

  // qtipMenu 선택 이벤트
  qtipEleMenu( action, targets ){
    console.log( 'qtipEleMenu:', action, targets );
  }
  
}
