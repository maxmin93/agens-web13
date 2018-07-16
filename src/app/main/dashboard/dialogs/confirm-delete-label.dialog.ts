import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { ILabel } from '../../../models/agens-data-types';

@Component({
  selector: 'app-confirm-delete-label-dialog',
  template: `
    <h2 mat-dialog-title>
      CONFIRM <br/>
      <small> Are you sure to delete this LABEL?</small>
    </h2>
    <p><i class="material-icons">info_outline</i> ALL DATA will also be removed !!</p>
    <div mat-dialog-content>
      <div class="example-container">
        <mat-form-field class="example-full-width">
          <input matInput placeholder="TYPE" readonly value="{{data.type}}">
        </mat-form-field>
        <mat-form-field class="example-full-width">
          <input matInput placeholder="OID" readonly value="{{data.oid}}">
        </mat-form-field>
        <mat-form-field class="example-full-width">
          <input matInput placeholder="NAME" readonly value="{{data.name}}">
        </mat-form-field>
        <mat-form-field class="example-full-width">
          <input matInput placeholder="SIZE" readonly value="{{data.size}}">
        </mat-form-field>
      </div>
    </div>
    <div mat-dialog-actions>
      <button mat-button [mat-dialog-close]="data" tabindex="2" class="btn">Ok</button>
      <button mat-button (click)="onCancel()" tabindex="-1" class="btn">Cancel</button>
    </div>  
    `,
  styles: [`
 
  .mat-dialog-title { 
    
    padding-left: 12px; 
    padding-top: 4px; 
    border-left: 4px solid #616b88; 
    line-height: 22px; 
  }

  p { 
    background-color: rgba(234,97,74,0.8); 
    padding: 4px 8px; 
    border-radius: .225rem; 
    border: 1px solid #de452c;
    text-transform: uppercase; 
    font-size: 13px; 
    color: #282828; 
    display: flex; 
    align-items: center; 
    margin-bottom: 20px; 
  }

  .material-icons { 
    font-size: 22px; 
    margin-right: 8px; 
  }

  .mat-dialog-actions { 
    justify-content: flex-end; 
  }

  .mat-dialog-actions:last-child { 
    margin: 0; 
    padding: 0; 
  }

  small { 
    font-size: 12px; 
  }

  .example-container {
    display: flex;
    flex-direction: column;
  }  
  
  .example-form {
    min-width: 150px;
    max-width: 360px;
    width: 100%;
  }
  
  .example-full-width {
    width: 100%;
  }

  .btn {
    padding: 6px 16px; 
    border-radius: .225rem; 
    border: 1px solid #aaa;
    box-sizing: border-box; 
    font-size: 12px; 
    font-weight: 600; 
    color: #565656; 
    text-transform: uppercase; 
    letter-spacing: .065rem;
    line-height: 18px;  
  }
  `]
})
export class ConfirmDeleteLabelDialog implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<ConfirmDeleteLabelDialog>,
    @Inject(MAT_DIALOG_DATA) public data: ILabel
  ) { 
  }

  ngOnInit() {
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

}
