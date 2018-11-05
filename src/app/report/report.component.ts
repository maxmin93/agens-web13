import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
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

  title = 'AgensBrowser Report';
  isLoading:boolean = true;
  private handler_param: Subscription;

  id: number;
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

  timer_max = 1.0;
  timer_curr = 0;
  handler_timer:Subscription;

  constructor(
    private _path: ActivatedRoute,
    private _router: Router,
    private _api: AgensDataService,
    public _snackBar: MatSnackBar
  ) { 
  }

  ngOnInit(){
    this.handler_param = this._path.params.subscribe(params => {
      this.id = +params['id']; // (+) converts string 'id' to a number

      // In a real app: dispatch action to load the details here.
      // this.getReport(this.id);
    });

    // get return url from route parameters or default to '/'
    // this.returnUrl = this._route.snapshot.queryParams['returnUrl'] || '/';
  }

  ngAfterViewInit(){
    let spinner$:Observable<number> = interval(100);
    this.handler_timer = spinner$.pipe(
      takeWhile(_ => this.timer_curr < this.timer_max ),
      tap(i => this.timer_curr += 0.1)
    )
    .subscribe();
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
          this.refreshCanvas();
        });    
  }

  /////////////////////////////////////////////////

  refreshCanvas(){
    // this.cy.resize();
    // this.cy.style(agens.graph.stylelist['dark']).update();
    // this.cy.fit( this.cy.elements(), 50);
    // agens.cy = this.cy;
  }

}
