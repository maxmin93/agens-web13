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
declare var agens : any;

@Component({
  selector: 'app-report',
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.scss']
})
export class ReportComponent implements OnInit, AfterViewInit, OnDestroy {

  // initialization
  title = 'AgensBrowser Report';
  isLoading:boolean = true;
  private handler_param: Subscription;
  private todo$:Subject<any> = new Subject();

  // AgensBrowser API
  pid: number;
  private handlers: Subscription[] = [ undefined, undefined, undefined, undefined, undefined, undefined ];
  private projectDto: IGraphDto = undefined;
  private projectGraph: IGraph = undefined;
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
      this.pid = +params['pid']; // (+) converts string 'id' to a number

      // In a real app: dispatch action to load the details here.
      this.getReport(this.pid);
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
      console.log( 'tap:', e.target );
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
  }

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

  getReport(id:number) {

      // **NOTE: load 대상 graph 에 아직 gid 연결 안했음 (2018-10-12)
      let data$:Observable<any> = this._api.grph_load(id);
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
          console.log('END:', this.projectDto, this.projectGraph);
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
      this.cy.add( e );
    });
    graph.edges.forEach(e => {
      this.cy.add( e );
    });
  }

  /////////////////////////////////////////////////

  clickGraphLabelChip(target:ILabel){

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
    console.log('target:', target._private);
    // null 이 아니면 정보창 (infoBox) 출력
    if( !target.isParent() ){         // parent 는 정보창 출력 대상에서 제외
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

  refreshCanvas(){
    agens.cy = this.cy;
    this.cy.resize();
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.fit( this.cy.elements(), 50);
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

  // qtipMenu 선택 이벤트
  qtipEleMenu( action, targets ){
    console.log( 'qtipEleMenu:', action, targets );
  }
  
}
