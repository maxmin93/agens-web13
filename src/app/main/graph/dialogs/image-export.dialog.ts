import { Component, ViewChild , Inject, OnInit, ElementRef } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-image-export-dialog',
  template: `
    <div>
      <form novalidate [formGroup]="exportForm"></form>
      <div class="dialog-tit"><span><mat-icon>image</mat-icon></span> <h4>Image <strong>Export</strong></h4></div>
      <span class="dialog-subtit">Save PNG image file with watermark</span>
      
      <div>
        <div id="export-image" class="graph-image">
          <img #divGraphImage />
          <div id="export-watermark" class="row row-r mt10">
            <span>{{exportWatermarkCtl.value}}</span>
          </div>
        </div>   
        <div class="col mt20">           
          <mat-form-field>
            <input matInput [formControl]="exportWatermarkCtl" placeholder="Water-mark">
            <button mat-button *ngIf="exportWatermarkCtl.value" matSuffix mat-icon-button aria-label="Clear" 
                    (click)="exportWatermarkCtl.setValue('')">
              <mat-icon>close</mat-icon>
            </button>
            <mat-error *ngIf="exportWatermarkCtl.hasError('maxlength')">
              Watermark is <strong>too long</strong>. (max={{MAX_WATERMARK_SIZE}})
            </mat-error>
          </mat-form-field>
          <mat-form-field>
            <input matInput [formControl]="exportFilenameCtl" placeholder="File name" required>
            <button disableRipple mat-icon-button *ngIf="exportFilenameCtl.value" matSuffix aria-label="Clear" 
                  (click)="exportFilenameCtl.setValue('')">
              <mat-icon >close</mat-icon>
            </button>
            <mat-error *ngIf="exportFilenameCtl.hasError('pattern') && !exportFilenameCtl.hasError('required')">
              Filename has to <strong>start [a-zA-Z] char and length is 3~30</strong>
            </mat-error>
            <mat-error *ngIf="exportFilenameCtl.hasError('required')">
              Filename is <strong>required</strong>
            </mat-error>
          </mat-form-field>
        </div>   
      </div>
      <div class="btn-group row row-r">
        <button mat-stroked-button color="primary" type="submit" 
            [disabled]="!exportForm.valid" (click)="onSubmit()" tabindex="2">Submit</button>
        <button mat-flat-button color="primary" (click)="onCancel()" tabindex="-1" >Cancel</button>
      </div>
    </div>    
     
    `,
  styles: [`    
    mat-form-field button { height: 31px; }
    mat-form-field mat-icon { font-size: 15px !important; margin-left: -11px; margin-top: 8px; }
  `]
})
export class ImageExportDialog implements OnInit {

  watermark:string = 'BITNINE.NET';
  file_name:string = '';
  ext_name:string = '.png';

  MAX_WATERMARK_SIZE: number = 30;

  exportForm: FormGroup;
  exportWatermarkCtl: FormControl;
  exportFilenameCtl: FormControl;
  
  @ViewChild('divGraphImage') divGraphImage: ElementRef;

  constructor(
    public dialogRef: MatDialogRef<ImageExportDialog>,
    @Inject(MAT_DIALOG_DATA) public graph: any
  ) { 
  }

  ngOnInit() {
    // Form controllers
    this.exportFilenameCtl = new FormControl('', [ 
      Validators.required, Validators.pattern(/^[a-zA-Z]{1}[a-zA-Z0-9_]{2,29}$/)
    ]);
    this.exportWatermarkCtl = new FormControl(this.watermark, [Validators.maxLength(this.MAX_WATERMARK_SIZE)]);

    this.exportForm = new FormGroup({
      exportFilename: this.exportFilenameCtl,
      exportWatermark: this.exportWatermarkCtl
    });

    // 화면에 맞게 elements 정렬
    // ==> 너비가 긴 레이아웃에는 세로 여백이 길어진 형태로 나타남. 
    //     fit, resize, reset 모두 안통함. 
    //     그러나 실제 export 때는 스케일에 맞춰 출력함. 안심하라.
    //

    // make snapshot image of GRAPH
    var png64 = this.graph.png({ full : true });
    this.divGraphImage.nativeElement.setAttribute("src", png64);
  }

  onSubmit(): void {
    this.watermark = this.exportWatermarkCtl.value;
    this.file_name = this.exportFilenameCtl.value+this.ext_name;

    this.dialogRef.close({ filename: this.file_name, watermark: this.watermark });
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

}
