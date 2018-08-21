import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { ILabel } from '../../../models/agens-data-types';

@Component({
  selector: 'app-confirm-delete-label-dialog',
  template: `
    <h4>CONFIRM <strong>INFO</strong></h4>
    <span class="subtitle p-no m-10">Are you sure to delete this LABEL? <br/>If you remove label, All data will also be removed!</span>
    <div class="col m-10">
      <form class="strech col">
        <mat-form-field class="m-10">
          <input matInput placeholder="TYPE" readonly value="{{data.type}}">
        </mat-form-field>
        <mat-form-field>
          <input matInput placeholder="OID" readonly value="{{data.oid}}">
        </mat-form-field>
        <mat-form-field class="m-10">
          <input matInput placeholder="NAME" readonly value="{{data.name}}">
        </mat-form-field>
        <mat-form-field class="m-10">
          <input matInput placeholder="SIZE" readonly value="{{data.size}}">
        </mat-form-field>
      </form>
    </div>
    <div class="m-10 row-end">
      <button mat-button [mat-dialog-close]="data" tabindex="2">OK</button>
      <button mat-button (click)="onCancel()" tabindex="-1">CANCEL</button>
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
