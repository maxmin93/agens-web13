import { Component, ViewChild , Inject, OnInit, OnDestroy, NgZone, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material';
import { HttpErrorResponse } from '@angular/common/http';

import { Observable, Subscription } from 'rxjs';
import { concatAll, filter } from 'rxjs/operators';

import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { MatSnackBar } from '@angular/material';
import { DatatableComponent } from '@swimlane/ngx-datatable';

import { ILabel, IGraph, INode, IEdge, IEnd } from '../../../../models/agens-data-types';
import { IProject } from '../../../../models/agens-manager-types';
import { IGraphDto, IResponseDto } from '../../../../models/agens-response-types';
// services
import { AgensDataService } from '../../../../services/agens-data.service';

declare var agens: any;

@Component({
  selector: 'app-overlay-graph',
  templateUrl: './overlay-graph.component.html',
  styleUrls: ['./overlay-graph.component.scss']
})
export class OverlayGraphComponent implements OnInit {

  private handlers: Array<Subscription> = [
    undefined, undefined, undefined, undefined, undefined, undefined
  ];
  isLoading: boolean = false;

  projectDto:IGraphDto = undefined;
  overlayGraph:IGraph = undefined;

  // 매칭에 사용될 nodes 의 id 리스트
  ids: string[] = [];
  // 스타일 부여를 위해 labels 유지
  labels: ILabel[] = [];
  // position for adjust center
  extent: any = { x1: 9999999, x2: -9999999, y1: 9999999, y2: -9999999 };
  center: any = undefined;

  // data array
  projectRows: IProject[] = [];
  // filtering 을 위한 임시 array
  tmpRows: IProject[] = [];

  @ViewChild('matchTestMessage') matchTestMessage: ElementRef;
  @ViewChild('projectsTable') projectsTable: DatatableComponent;

  constructor(
    private _cd: ChangeDetectorRef,
    private _api: AgensDataService,
    private _sheetRef: MatBottomSheetRef<OverlayGraphComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any            
  ) { 
    if( data.hasOwnProperty('ids') ) this.ids = data['ids'];
    if( data.hasOwnProperty('labels') ) this.labels = data['labels'];
    if( data.hasOwnProperty('center') ) this.center = data['center'];
  }

  ngOnInit() {
  }

  ngOnDestroy(): void {
    this.handlers.forEach(x => {
      if( x ) x.unsubscribe();
      x = undefined;
    });
  }

  ngAfterViewInit() {
    this.loadProjects();
  }  

  close(row:any=undefined): void {
    if( row ){
      this.loadProjectGraph( row.id );
    }
    else this._sheetRef.dismiss();
    event.preventDefault();
  }

  cyCanvasCallback(){

  }

  cyElemCallback(target){

  }

  /////////////////////////////////////////////////////////////////
  // Data Handlers
  /////////////////////////////////////////////////////////////////
  
  // call API: manager/logs  
  loadProjects( message_out:boolean = true ){

    this.tmpRows = [];
    this.projectRows = [];

    this._api.mngr_projects_list().pipe( concatAll() )
    .subscribe(
      data => {
        this.tmpRows.push( <IProject>data );
      },
      err => {
        console.log('ERROR: ',err);
        this._sheetRef.dismiss();
      },
      () => {
        // cache our list
        this.projectRows = [...this.tmpRows];
        // this._angulartics2.eventTrack.next({ action: 'listProjects', properties: { category: 'graph', label: data.length }});
        this._cd.detectChanges();
      });    
  }

  // Table page event
  toggleExpandRow(row) {
    this.projectsTable.rowDetail.toggleExpandRow(row);
  }

  onRowDetailToggle(event) {
    // console.log('Detail Toggled', event);   // type=row, value={row}
  }

  onActivateTableLabels(event){
    if( event.row.id ){
      this._api.grph_matching_test( event.row.id, this.ids ).subscribe(x => {
        if(x){
          // console.log( 'matching test:', event.row.id, x );
          this.matchTestMessage.nativeElement.value = x.message;
          // meesage out!!
          this._cd.detectChanges();
        }
      })
    }
  }

  updateFilter(event) {
    if( this.projectRows.length == 0 ){
      event.preventDefault();      
      return;
    }
    const val = event.target.value.toLowerCase();
    // filter our data
    const temp = this.tmpRows.filter(function(d) {
      return d.title.toLowerCase().indexOf(val) !== -1 || !val;
    });

    // update the rows
    this.projectRows = temp;
  }  

  loadProjectGraph(pid:number){
    // **NOTE: load 대상 graph 에 아직 gid 연결 안했음 (2018-10-12)
    let data$:Observable<any> = this._api.grph_load(pid, true);

    this.isLoading = true;
    // load GraphDto to json array
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
        this.ngOnDestroy();
      });

    /////////////////////////////////////////////////
    // Graph 에 표시될 내용은 누적해서 유지
    this.handlers[1] = data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
          this.overlayGraph = x;
          this.overlayGraph.labels = new Array<ILabel>();
          this.overlayGraph.nodes = new Array<INode>();
          this.overlayGraph.edges = new Array<IEdge>();

          // create parent node          
          this.overlayGraph.nodes.push(<INode>{
            group: 'nodes',
            data: { 
              id: agens.graph.makeid(),
              parent: undefined,
              label: 'overlay',
              props: {},
              size: 1          
            },
            scratch: {},
            classes: 'overlay',
            position: undefined
          });
      });
    this.handlers[2] = data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => {
        this.overlayGraph.labels.push( x );
      });
    this.handlers[3] = data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
        x.scratch['_id'] = x.data.id;               // 원본 id를 scratch에 저장 
        x.data.id = '$$'+x.data.id;                 // 다른 id를 만들어야 overlay 시킬 수 있음
        x.data.parent = this.overlayGraph.nodes[0].data.id;   // set parent
        x.classes = 'overlay';
        this.overlayGraph.nodes.push( x );  
        // get extent of overlay graph
        if( x.hasOwnProperty('position') && x['position'] ){
          if( x.position['x'] < this.extent['x1'] ) this.extent['x1'] = x.position['x'];  // x min
          if( x.position['x'] > this.extent['x2'] ) this.extent['x2'] = x.position['x'];  // x max
          if( x.position['y'] < this.extent['y1'] ) this.extent['y1'] = x.position['y'];  // y min
          if( x.position['y'] > this.extent['y2'] ) this.extent['y2'] = x.position['y'];  // y max
        }
      });
    this.handlers[4] = data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        x.scratch['_id'] = x.data.id;               // 원본 id를 scratch에 저장 
        x.data.id = '$$'+x.data.id;                 // 다른 id를 만들어야 overlay 시킬 수 있음
        x.scratch['_source'] = x.data.source;       // 
        x.data.source = '$$'+x.data.source;         // source id
        x.scratch['_target'] = x.data.target;       // 
        x.data.target = '$$'+x.data.target;         // target id
        x.data.parent = this.overlayGraph.nodes[0].data.id;   // set parent
        x.classes = 'overlay';
        this.overlayGraph.edges.push( x );  
      });
    /////////////////////////////////////////////////
    // Graph의 Label 별 카운팅 해서 갱신
    //  ==> ILabel.size, IGraph.labels_size/nodes_size/edges_size
    this.handlers[5] = data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        // adjust position
        if( this.center ){
          let temp = { x: (this.extent['x1']+this.extent['x2'])/2, y: (this.extent['y1']+this.extent['y2'])/2 };
          let diffPos = {x: this.center['x']-temp['x'], y: this.center['y']-temp['y']};
          this.overlayGraph.nodes.filter(x => x.position).forEach(x => {
            x.position['x'] += diffPos['x'];
            x.position['y'] += diffPos['y'];
          });
        }

        this.isLoading = false;
        this._sheetRef.dismiss( this.overlayGraph );      // close sheet
      });    
  }

}
