import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { ILabel } from '../../../models/agens-data-types';

@Component({
  selector: 'app-confirm-delete-label-dialog',
  template: `
    <div class="dialog-tit"><span><mat-icon>delete</mat-icon></span> <h4>CONFIRM <strong>INFO</strong></h4></div>
    <span class="dialog-subtit red">Are you sure to delete this LABEL? <br/>If you remove label, All data will also be removed!</span>
    <div class="col">
      <form class="strech col">
        <mat-form-field>
          <input matInput placeholder="TYPE" readonly value="{{data.type}}">
        </mat-form-field>
        <mat-form-field>
          <input matInput placeholder="ID" readonly value="{{data.id}}">
        </mat-form-field>
        <mat-form-field>
          <input matInput placeholder="NAME" readonly value="{{data.name}}">
        </mat-form-field>
        <mat-form-field>
          <input matInput placeholder="SIZE" readonly value="{{data.size}}">
        </mat-form-field>
      </form>
    </div>
    <div class="btn-group row row-r">
      <button mat-stroked-button color="primary" [mat-dialog-close]="data" tabindex="2">OK</button>
      <button mat-flat-button color="primary" (click)="onCancel()" tabindex="-1">CANCEL</button>
    </div>  
    `,
  styles: [`

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
