import { Component, Inject, OnInit, OnDestroy, NgZone, ViewChild, ElementRef } from '@angular/core';
import { NgForm, FormGroup, FormControl, Validators } from '@angular/forms';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http/src/response';
import { Observable } from 'rxjs';

import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material';

import * as CONFIG from '../../../app.config';
import { IProject } from '../../../models/agens-manager-types';

// services
import { AgensDataService } from '../../../services/agens-data.service';

declare var $:any;
declare var agens:any;

@Component({
  selector: 'app-project-save-dialog',
  template: `
<h2 mat-dialog-title>
  Project Save<br/>
  <small>type title and description about your project</small>
</h2>
<div mat-dialog-content>
  
  <form class="example-form" novalidate [formGroup]="projectForm">
  <img #divGraphImage style="width: 400px;" />
  <div class="example-container">

    <mat-form-field class="example-full-width">
      <input matInput name="projectId" value="{{project.id}}" placeholder="ID" disabled>
    </mat-form-field>

    <mat-form-field class="example-full-width">
      <input matInput name="projectTitle" [formControl]="projectTitleCtl" placeholder="Title" required>
      <button mat-button *ngIf="projectTitleCtl.value" matSuffix mat-icon-button aria-label="Clear" 
            (click)="projectTitleCtl.setValue('')">
        <mat-icon>close</mat-icon>
      </button>
      <mat-error *ngIf="projectTitleCtl.hasError('maxLength')">
        Title has to be less than <strong>{{MAX_TITLE_SIZE}} characters</strong>.
      </mat-error>
      <mat-error *ngIf="projectTitleCtl.hasError('required')">
        Title is <strong>required</strong>
      </mat-error>
    </mat-form-field>
    <mat-form-field class="example-full-width">
      <textarea matInput name="projectDescription" [formControl]="projectDescriptionCtl" placeholder="Description"
            matTextareaAutosize matAutosizeMinRows="1" matAutosizeMaxRows="5"></textarea>
      <button mat-button *ngIf="projectDescriptionCtl.value" matSuffix mat-icon-button aria-label="Clear" 
            (click)="projectDescriptionCtl.setValue('')">
        <mat-icon>close</mat-icon>
      </button>
      <mat-error *ngIf="projectDescriptionCtl.hasError('maxLength')">
        Description has to be less than <strong>{{MAX_DESCRIPTION_SIZE}} characters</strong>.
      </mat-error>
    </mat-form-field>

    <mat-form-field class="example-full-width">
      <input matInput name="projectCreateDt" value="{{project.create_dt | date:'yyyy-MM-dd HH:mm'}}" placeholder="Create Date" disabled>
    </mat-form-field>
    <mat-form-field class="example-full-width">
      <input matInput name="projectUpdateDt" value="{{project.update_dt | date:'yyyy-MM-dd HH:mm'}}" placeholder="Update Date" disabled>
    </mat-form-field>

  </div>
  </form>
</div>
<div mat-dialog-actions>
  <button mat-button type="submit" class="btn btn-default" 
        [disabled]="!projectForm.valid" (click)="onSubmit()" tabindex="2">Submit</button>
  <button mat-button (click)="onCancel()" tabindex="-1" class="btn">Cancel</button>
</div>  

<!-- JQuery dialog-confirm : project overwrite -->
<div id="confirm-project-overwrite" title="[WARNING] overwrite project" style="display:none;">
  <p><span class="ui-icon ui-icon-alert" style="float:left; margin:12px 12px 20px 0;"></span>This project will be overwrited if you choose 'overwrite'. Are you sure?</p>
</div>
`,
styles: [`

  `]
})
export class ProjectSaveDialog implements OnInit, OnDestroy {

  // 로딩 상태
  private isLoading:boolean = false;
  private cy:any;
  imgBlob:Blob;

  projectForm: FormGroup;
  projectTitleCtl: FormControl;
  projectDescriptionCtl: FormControl;

  MAX_TITLE_SIZE: number = 400;
  MAX_DESCRIPTION_SIZE: number = 900;

  project: IProject = {
      id: null,
      userName: null,
      userIp: null,
      title: '',
      description: '',
      create_dt: Date.now(),    // timestamp
      update_dt: Date.now(),    // timestamp
      sql: '',
      graph_json: '{}',
      styles_json: '{}',
      positions_json: '{}',
      image: null
    };

  @ViewChild('divGraphImage') divGraphImage: ElementRef;
  constructor(
    private _api: AgensDataService,
    private _ngZone: NgZone,
    public _snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ProjectSaveDialog>,
    @Inject(MAT_DIALOG_DATA) public data: IProject
  ) { 
    if( data != null ) this.project = data;
  }

  ngOnInit() {
    this.projectTitleCtl = new FormControl( this.project.title, [ Validators.maxLength(this.MAX_TITLE_SIZE), Validators.required ]);
    this.projectDescriptionCtl = new FormControl( this.project.description, [ Validators.maxLength(this.MAX_DESCRIPTION_SIZE) ]);

    this.projectForm = new FormGroup({
      projectTitle: this.projectTitleCtl,
      projectDescription: this.projectDescriptionCtl
    });

    this.divGraphImage.nativeElement.setAttribute("src", URL.createObjectURL(this.project.image));

    // prepare to call this.function from external javascript
    window['angularDialogRef'] = {
      zone: this._ngZone,
      cancelDialogCallback: () => this.onCancel(),
      submitDialogCallback: () => this.saveProject(),
      component: this
    };
  }  

  ngOnDestroy() {
    window['angularDialogRef'] = null;
  }

  onSubmit(): void {
    this.project.title = this.projectTitleCtl.value;
    this.project.description = this.projectDescriptionCtl.value;

    // project overwrite 인 경우에 한번 더 confirm : jquery dialog
    if( this.project.id !== null ){
      $( function() {
        $( "#confirm-project-overwrite" ).dialog({
          resizable: false,
          height: "auto",
          width: 400,
          modal: true,
          buttons: {
            "Overwrite": function() {
              $( this ).dialog( "close" );
              if( window['angularDialogRef'] !== null && window['angularDialogRef'].submitDialogCallback !== undefined )
                (window['angularDialogRef'].submitDialogCallback)();
            },
            Cancel: function() {
              $( this ).dialog( "close" );
              if( window['angularDialogRef'] !== null && window['angularDialogRef'].cancelDialogCallback !== undefined )
                (window['angularDialogRef'].cancelDialogCallback)();
            }
          }
        });
      } );
    }
    else{
      this.saveProject();
    }
  }

  onCancel(): void {
    this.dialogRef.close(<IProject>null);
  }

  /////////////////////////////////////////////////////////////////
  // Common Controllers
  /////////////////////////////////////////////////////////////////

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action, { duration: 3000, });
  }
 
  /////////////////////////////////////////////////////////////////
  // Data Handlers
  /////////////////////////////////////////////////////////////////
  
  // call API: manager/logs  
  saveProject() {    
    // 이상 없으면 입력값 리턴
    if( this.projectForm.valid ){

      this._api.mngr_project_save(this.project)
      .subscribe(
        data => {
          // this.openSnackBar(`project[${data.id}] was saved`, 'DONE');
          this.dialogRef.close(<IProject>data);
        },
        err => {
          this.dialogRef.close(<IProject>null);
        });
    }    
  }
 
}
