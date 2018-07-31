import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { ILabel } from '../../../models/agens-data-types';

@Component({
  selector: 'app-confirm-delete-label-dialog',
  template: `
    <h4>CONFIRM <strong>INFO</strong></h4>
    <p class="subtext">Are you sure to delete this LABEL? <br/>All data will also be removed!</p>
    <div mat-dialog-content>
      <form class="margin">
        <mat-form-field class="block">
          <input matInput placeholder="TYPE" readonly value="{{data.type}}">
        </mat-form-field>
        <mat-form-field class="block">
          <input matInput placeholder="OID" readonly value="{{data.oid}}">
        </mat-form-field>
        <mat-form-field class="block">
          <input matInput placeholder="NAME" readonly value="{{data.name}}">
        </mat-form-field>
        <mat-form-field class="block">
          <input matInput placeholder="SIZE" readonly value="{{data.size}}">
        </mat-form-field>
      </form>
    </div>
    <div mat-dialog-actions>
      <button mat-button (click)="onCancel()" tabindex="-1" class="btn">CANCEL</button>
      <button mat-button [mat-dialog-close]="data" tabindex="2" class="btn">OK</button>
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
