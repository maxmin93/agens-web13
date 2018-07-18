import { Component, ViewChild , Inject, OnInit, OnDestroy, NgZone, ElementRef, AfterViewInit } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http/src/response';
import { Observable } from 'rxjs';

import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { MatSnackBar } from '@angular/material';
import { DatatableComponent } from '@swimlane/ngx-datatable';

import * as CONFIG from '../../../global.config';
import { IProject } from '../../../models/agens-manager-types';

// services
import { AgensDataService } from '../../../services/agens-data.service';

import { IResponseDto } from '../../../models/agens-response-types';

import { Angulartics2 } from 'angulartics2';

declare var $:any;

@Component({
  selector: 'ab-project-open-dialog',
  template: `

<h2 mat-dialog-title>
  <div class="card__icon-group">
    <a matTooltip="Refresh" matTooltipPosition="above" (click)="loadProjects()"><mat-icon>refresh</mat-icon></a>  
  </div>
  User Projects <br/><small> select project and edit query</small>    
</h2>

<div mat-dialog-content>
  <div class="example-container">
    <div class="div__search wrapped-box-flex">
      <span><i class="fa fa-search" aria-hidden="true"></i><input
          type='text'          
          placeholder='Type to filter the title column...'
          (keyup)='updateFilter($event)'
        /></span>
    </div>
    <div class="wrapped-box-flex">

    <ngx-datatable #projectsTable class='material' [columnMode]="'flex'"
      [rows]="projectRows" [reorderable]="reorderable" [limit]="10"
      [headerHeight]="38" [footerHeight]="38" [rowHeight]="'auto'"
      (activate)="onActivateTableLabels($event)">

        <ngx-datatable-row-detail [rowHeight]="auto" #projectRow (toggle)="onRowDetailToggle($event)">
        <ng-template let-row="row" ngx-datatable-row-detail-template>
          <div>
            <div class="span__row-detail-content">
              <span><i class="fa fa-reply fa-rotate-180" aria-hidden="true"></i> {{ row[row._selectedColumn] }}</span>
            </div>
          </div>
        </ng-template>
        </ngx-datatable-row-detail>

        <ngx-datatable-column name="ID" [flexGrow]="1">
        <ng-template let-row="row" ngx-datatable-cell-template>
          <strong><a (click)="onSubmit(row.id)">{{row.id}}</a></strong>
        </ng-template>
        </ngx-datatable-column>
        <ngx-datatable-column name="Title" [flexGrow]="4">
        <ng-template let-row="row" ngx-datatable-cell-template>
          <button *ngIf="row.description" mat-icon-button matTooltip="Expand/Collapse Row"
              (click)="toggleLogExpandRow(row, 'description')">
            <i [class.datatable-icon-right]="!row.$$expanded" [class.datatable-icon-down]="row.$$expanded"></i>
          </button>
          <span><a matTooltip="{{row.title}}" matTooltipPosition="above" (click)="onSubmit(row.id)">{{row.title}}</a></span>
        </ng-template>
        </ngx-datatable-column>
        <ngx-datatable-column name="Create Date" [sortable]="true" prop="create_dt" [flexGrow]="2">
        <ng-template let-row="row" ngx-datatable-cell-template>
          <span>{{ row.create_dt | date:'yyyy-MM-dd HH:mm' }}</span>
        </ng-template>
        </ngx-datatable-column>
        <ngx-datatable-column name="Update Date" [sortable]="true" prop="update_dt" [flexGrow]="2">
        <ng-template let-row="row" ngx-datatable-cell-template>
          <span>{{ row.update_dt | date:'yyyy-MM-dd HH:mm' }}</span>
        </ng-template>
        </ngx-datatable-column>
        <ngx-datatable-column name="Remove" [sortable]="false" [flexGrow]="1">
        <ng-template let-row="row" ngx-datatable-cell-template>
          <a (click)="deleteProjectAfterConfirm(row)" mdTooltip="Delete" mdTooltipPosition="before">
              <mat-icon>delete</mat-icon>
          </a>
        </ng-template>
        </ngx-datatable-column>            

      </ngx-datatable>
    </div>
  </div>
</div>
<div mat-dialog-actions>
  <button mat-button (click)="onCancel()" tabindex="-1" class="btn">Close</button>
</div>  

<!-- JQuery dialog-confirm : project overwrite -->
<div id="confirm-project-delete" title="[WARNING] delete project" style="display:none;">
  <p><span class="ui-icon ui-icon-alert" style="float:left; margin:12px 12px 20px 0;"></span>This project will be deleted if you choose 'delete'. Are you sure?</p>
</div>
`,
styles: [`

  .card__icon-group { 
    float: right; 
  }
  .card__icon-group a { 
    display: inline-block; 
    margin-left: 10px; 
    color: #585858; 
  }
  .div__hisotry-table { 
    padding: 0; 
  }
  .div__search {
    padding: 0; margin-bottom: 20px; 
  }
  .div__search input { 
    margin: 0;     
  }
  ngx-datatable { 
    border-top: 1px solid #ccc; 
  }
 
  `]
})
export class ProjectOpenDialog implements OnInit, OnDestroy, AfterViewInit {

  // data array
  projectRows: IProject[] = [];
  // filtering 을 위한 임시 array
  tmpRows: IProject[] = [];

  @ViewChild('projectsTable') projectsTable: DatatableComponent;
  
  constructor(
    private _http: HttpClient,
    private _api: AgensDataService,
    private _ngZone: NgZone,
    private _angulartics2: Angulartics2,
    public _snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ProjectOpenDialog>,
    @Inject(MAT_DIALOG_DATA) public data: IProject
  ) { 
  }

  ngOnInit(){
    // prepare to call this.function from external javascript
    window['angularDialogRef'] = {
      zone: this._ngZone,
      cancelDialogCallback: undefined,
      submitDialogCallback: (row) => this.deleteProject(row),
      component: this
    };
  }  

  ngOnDestroy() {
    window['angularDialogRef'] = null;
  }
  
  ngAfterViewInit() {
    this.loadProjects();
  }  

  onSubmit(id:number): void {

    this._api.mngr_project_detail(id)
    .subscribe(
      data => {
        this.dialogRef.close(<IProject>data);
      },
      err => {
        this.dialogRef.close(<IProject>null);
      });    
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  /////////////////////////////////////////////////////////////////
  // Data Handlers
  /////////////////////////////////////////////////////////////////
  
  // call API: manager/logs  
  loadProjects( message_out:boolean = true ){

    this._api.mngr_projects_list()
    .subscribe(
      data => {
        this.projectRows.push(data);
        
      },
      err => {
        this.onCancel();
      },
      () => {
        // cache our list
        this.tmpRows = [...this.projectRows];
        // this._angulartics2.eventTrack.next({ action: 'listProjects', properties: { category: 'graph', label: data.length }});
      });    
  }

  // Table page event
  toggleLogExpandRow(row, col) {
    // console.log('Toggled Expand Row!', col);
    row._selectedColumn = col;
    this.projectsTable.rowDetail.toggleExpandRow(row);
  }

  onRowDetailToggle(event) {
    // console.log('Detail Toggled', event);   // type=row, value={row}
  }

  onActivateTableLabels(event){
    // console.log('onActivateTableLabels: ', event);
  }

  updateFilter(event) {
    const val = event.target.value.toLowerCase();

    // filter our data
    const temp = this.tmpRows.filter(function(d) {
      return d.title.toLowerCase().indexOf(val) !== -1 || !val;
    });

    // update the rows
    this.projectRows = temp;
  }  

  deleteProjectAfterConfirm(row){
    $( function() {
      $( "#confirm-project-delete" ).dialog({
        resizable: false,
        height: "auto",
        width: 400,
        modal: true,
        buttons: {
          "Delete": function() {
            $( this ).dialog( "close" );
            if( window['angularDialogRef'] !== null && window['angularDialogRef'].submitDialogCallback !== undefined )
              (window['angularDialogRef'].submitDialogCallback)(row);
          },
          Cancel: function() {
            $( this ).dialog( "close" );
          }
        }
      });
    } );  
  }

  deleteProject(row){

    this._api.mngr_project_delete(row.id)
    .subscribe(
      data => {
      },
      (err:HttpErrorResponse) => {
        this.onCancel();
      },
      () => {
        // reload
        this.loadProjects( false );

        // this._angulartics2.eventTrack.next({ action: 'deleteProject', properties: { category: 'graph', label: row.id }});
      });    

  }
}
