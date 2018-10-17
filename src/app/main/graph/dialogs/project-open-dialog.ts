import { Component, ViewChild , Inject, OnInit, OnDestroy, NgZone, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http/src/response';
import { concatAll } from 'rxjs/operators';

import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { MatSnackBar } from '@angular/material';
import { DatatableComponent } from '@swimlane/ngx-datatable';

import { IProject } from '../../../models/agens-manager-types';
// services
import { AgensDataService } from '../../../services/agens-data.service';

declare var jQuery:any;

@Component({
  selector: 'app-project-open-dialog',
  template: `

<h2 mat-dialog-title>
  <div>
    <a matTooltip="Refresh" matTooltipPosition="above" (click)="loadProjects()"><mat-icon>refresh</mat-icon></a>  
  </div>
  User Projects <br/><small> select project and edit query</small>    
</h2>

<div>
  <div>
    <div class="wrapped-box-flex">
      <span><i class="fa fa-search" aria-hidden="true"></i><input
          type='text' #inputFilter
          placeholder='Type to filter the title column...'
          (keyup)='updateFilter($event)'
        /></span>
    </div>
    <img #imgProjectCapture style="width:100; height:100;" class="border-styles" />
    <div class="wrapped-box-flex">

    <ngx-datatable #projectsTable class='material' [columnMode]="'fixed'"
      [rows]="projectRows" [reorderable]="'reorderable'" [limit]="10"
      [headerHeight]="38" [footerHeight]="38" [rowHeight]="'auto'"
      (activate)="onActivateTableLabels($event)" >

      <!-- [selected]="selected" [selectionType]="'single'" (select)="onSelect($event)" > -->

        <ngx-datatable-row-detail [rowHeight]="'auto'" #projectRow (toggle)="onRowDetailToggle($event)">
          <ng-template let-row="row" let-expanded="expanded" ngx-datatable-row-detail-template>
            <div class="span__row-detail-content">
              <span><i class="fa fa-reply fa-rotate-180" aria-hidden="true"></i> {{ row.description }}</span>              
            </div>
          </ng-template>
        </ngx-datatable-row-detail>

        <!-- Column Templates -->
        <ngx-datatable-column [width]="60" 
              [resizeable]="false" [sortable]="false" [draggable]="false" [canAutoResize]="false">
          <ng-template let-row="row" let-expanded="expanded" ngx-datatable-cell-template>
            <a href="javascript:void(0)"
              [class.datatable-icon-right]="!expanded" [class.datatable-icon-down]="expanded"
              title="Expand/Collapse Row" (click)="toggleExpandRow(row)">
            </a>
          </ng-template>
        </ngx-datatable-column>

        <ngx-datatable-column name="ID" [width]="60" >
          <ng-template let-row="row" ngx-datatable-cell-template>
            <strong><a (click)="onSubmit(row)">{{row.id}}</a></strong>
          </ng-template>
        </ngx-datatable-column>

        <ngx-datatable-column name="Title" [minWidth]="200">
          <ng-template let-row="row" ngx-datatable-cell-template>
            <span><a matTooltip="{{row.title}}" matTooltipPosition="above" (click)="onSubmit(row)">{{row.title}}</a></span>
          </ng-template>
        </ngx-datatable-column>

        <ngx-datatable-column name="Create Date" [sortable]="true" prop="create_dt" [width]="120" >
          <ng-template let-row="row" ngx-datatable-cell-template>
            <span>{{ row.create_dt | date:'MM/dd HH:mm' }}</span>
          </ng-template>
        </ngx-datatable-column>

        <ngx-datatable-column name="Update Date" [sortable]="true" prop="update_dt" [width]="120" >
          <ng-template let-row="row" ngx-datatable-cell-template>
            <span>{{ row.update_dt | date:'MM/dd HH:mm' }}</span>
          </ng-template>
        </ngx-datatable-column>

        <ngx-datatable-column name="Remove" [sortable]="false" [width]="80">
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
.border-styles {
  margin: 2px 0;
  padding: 1px 3px;
  border-width: 2px;
  border-color: #aaa;
  border-style: solid;
} 
  `]
})
export class ProjectOpenDialog implements OnInit, OnDestroy, AfterViewInit {

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
    private _ngZone: NgZone,
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
    this.inputFilter.nativeElement.blur();
    this.loadProjects();
  }  

  onSubmit(row:any): void {
    this.dialogRef.close(row);
  }

  onCancel(): void {
    this.dialogRef.close(null);
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
        this.onCancel();
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

  deleteProjectAfterConfirm(row){

    if( confirm(`Are you sure to delete this project(id=${row.id})\n  ==> "${row.title}"`) ) {
      this.deleteProject(row);
    }
/*    
    // **NOTE: 이거 하나 쓰자고 jquery-ui 붙이는게 성능상 좋지않아 주석 처리 함! (2018-10-09)
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
*/
  }

  deleteProject(row){
    this._api.mngr_project_delete(row.id).subscribe(
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
