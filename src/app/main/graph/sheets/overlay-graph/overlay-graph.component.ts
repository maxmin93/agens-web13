import { Component, ViewChild , Inject, OnInit, OnDestroy, NgZone, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material';
import { HttpErrorResponse } from '@angular/common/http/src/response';
import { concatAll } from 'rxjs/operators';

import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { MatSnackBar } from '@angular/material';
import { DatatableComponent } from '@swimlane/ngx-datatable';

import { IProject } from '../../../../models/agens-manager-types';
// services
import { AgensDataService } from '../../../../services/agens-data.service';

@Component({
  selector: 'app-overlay-graph',
  templateUrl: './overlay-graph.component.html',
  styleUrls: ['./overlay-graph.component.scss']
})
export class OverlayGraphComponent implements OnInit {

  // data array
  projectRows: IProject[] = [];
  // filtering 을 위한 임시 array
  tmpRows: IProject[] = [];

  @ViewChild('inputFilter') inputFilter: ElementRef;
  @ViewChild('imgProjectCapture') imgProjectCapture: ElementRef;
  @ViewChild('projectsTable') projectsTable: DatatableComponent;

  constructor(
    private _cd: ChangeDetectorRef,
    private _api: AgensDataService,
    private _sheetRef: MatBottomSheetRef<OverlayGraphComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any            
  ) { 
    console.log('constructor', data);
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.inputFilter.nativeElement.blur();
    this.loadProjects();
  }  

  close(row:any=undefined): void {
    this._sheetRef.dismiss( row );
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
      this._api.mngr_project_image( event.row.id ).subscribe(x => {
        if(x){
          // console.log( 'capture image:', event.row.id, x.length );
          this.imgProjectCapture.nativeElement.src = x;
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

/*  
  loadProjectGraph(pid:number){
    // **NOTE: load 대상 graph 에 아직 gid 연결 안했음 (2018-10-12)
    let data$:Observable<any> = this._api.grph_load(this.gid, result.id);
    // load GraphDto to QueryGraph
    this.parseGraphDto2Project( data$ );
  }

  parseGraphDto2Project( data$:Observable<any> ){

    this.isLoading = true;

    this.handlers[0] = data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        this.projectDto = x;
        if( x.hasOwnProperty('gid') ) {       // gid 갱신
          this.gid = x.gid;
          this.queryGraph.setGid( x.gid );
          this.statGraph.setGid( x.gid );
        }
      },
      err => {
        console.log( 'project_load: ERROR=', err instanceof HttpErrorResponse, err.error );
        this._api.setResponses(<IResponseDto>{
          group: 'project::load',
          state: err.statusText,
          message: (err instanceof HttpErrorResponse) ? err.error.message : err.message
        });
        
        this.clearSubscriptions();
        // login 페이지로 이동
        this._router.navigate(['/login']);
      });

    /////////////////////////////////////////////////
    // Graph 에 표시될 내용은 누적해서 유지
    this.handlers[1] = data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        if( !this.resultGraph ){      // if not exists = NEW
          this.resultGraph = x;
          this.resultGraph.labels = new Array<ILabel>();
          this.resultGraph.nodes = new Array<INode>();
          this.resultGraph.edges = new Array<IEdge>();
        }
      });
    this.handlers[2] = data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        // not exists
        if( this.resultGraph.labels.map(y => y.id).indexOf(x.id) == -1 ){
          // new style
          x.scratch['_style'] = <IStyle>{ 
            width: (x.type == 'nodes') ? 45 : 3
            , title: 'name'
            , color: (x.type == 'nodes') ? this._util.nextColor() : undefined // this._util.getColor(0)
            , visible: true
          };
          x.scratch['_styleBak'] = _.cloneDeep(x.scratch['_style']);

          this.resultGraph.labels.push( x );
          this.statGraph.addLabel( x );
        }
        // **NOTE: labels 갱신은 맨나중에 resultGraph의 setData()에서 처리
      });
    this.handlers[3] = data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
        // setNeighbors from this.resultGraph.labels;
        x.scratch['_neighbors'] = new Array<string>();
        this.resultGraph.labels
          .filter(val => val.type == 'nodes' && val.name == x.data.label)
          .map(label => {
            x.scratch['_neighbors'] += label.targets;
            if( !x.scratch.hasOwnProperty('_style')) x.scratch['_style'] = label.scratch['_style']; // 없으면
            x.scratch['_styleBak'] = label.scratch['_styleBak'];  // 복사본은 항상 Label의 style과 일치하도록 
          });
        // if( x.data.props.hasOwnProperty('$$style')) x.scratch['_style'] = x.data.props['$$style'];
        // if( x.data.props.hasOwnProperty('$$classes')) x.classes = x.data.props['$$classes'];
        // if( x.data.props.hasOwnProperty('$$position')) x.position = x.data.props['$$position'];

        // not exists
        if( this.resultGraph.nodes.map(y => y.data.id).indexOf(x.data.id) == -1 ){
          this.resultGraph.nodes.push( x );
        } 
        this.queryGraph.addNode( x );
      });
    this.handlers[4] = data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.resultGraph.labels
          .filter(val => val.type == 'edges' && val.name == x.data.label)
          .map(label => {
            if( !x.scratch.hasOwnProperty('_style')) x.scratch['_style'] = label.scratch['_style']; // 없으면
            x.scratch['_styleBak'] =label.scratch['_styleBak'];
          });
        // if( x.data.props.hasOwnProperty('$$style')) x.scratch['_style'] = x.data.props['$$style'];
        // if( x.data.props.hasOwnProperty('$$classes')) x.classes = x.data.props['$$classes'];
  
        // not exists
        if( this.resultGraph.edges.map(y => y.data.id).indexOf(x.data.id) == -1 ){
          this.resultGraph.edges.push( x );  
        } 
        this.queryGraph.addEdge( x );
      });    

    /////////////////////////////////////////////////
    // Graph의 Label 별 카운팅 해서 갱신
    //  ==> ILabel.size, IGraph.labels_size/nodes_size/edges_size
    this.handlers[8] = data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        console.log('END:', this.projectDto);
        this.isLoading = false;        
        this.queryResult.setData(<IResponseDto>this.projectDto);   // 메시지 출력

        // send data to Canvas
        this.queryGraph.setData(this.resultGraph);
        // this.queryGraph.initCanvas(false);
        this.queryGraph.refreshCanvas();
      });    
  }
*/
}
