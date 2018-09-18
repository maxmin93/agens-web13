import { Component, ViewChild , Inject, OnInit, ElementRef } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-image-export-dialog',
  template: `
    <div mat-dialog-content>
      <form class="example-form" novalidate [formGroup]="exportForm"></form>
      <div class="example-container">
        <div id="export-image" class="example-full-width div__export-image-box">
          <img #divGraphImage />
          <div id="export-watermark" class="div__export-image-watermark">
            <span><strong>{{exportWatermarkCtl.value}}</strong></span>
          </div>
        </div>   
        <div> 
          <h2 mat-dialog-title>
            Image Export <br/>
            <small> save PNG image file with watermark</small>
          </h2>
          <mat-form-field class="example-full-width">
            <input matInput [formControl]="exportWatermarkCtl" placeholder="Water-mark">
            <button mat-button *ngIf="exportWatermarkCtl.value" matSuffix mat-icon-button aria-label="Clear" 
                    (click)="exportWatermarkCtl.setValue('')">
              <mat-icon>close</mat-icon>
            </button>
            <mat-error *ngIf="exportWatermarkCtl.hasError('maxlength')">
              Watermark is <strong>too long</strong>. (max={{MAX_WATERMARK_SIZE}})
            </mat-error>
          </mat-form-field>
          <mat-form-field class="example-full-width">
            <input matInput [formControl]="exportFilenameCtl" placeholder="File name" required>
            <button mat-button *ngIf="exportFilenameCtl.value" matSuffix mat-icon-button aria-label="Clear" 
                  (click)="exportFilenameCtl.setValue('')">
              <mat-icon>close</mat-icon>
            </button>
            <mat-error *ngIf="exportFilenameCtl.hasError('pattern') && !exportFilenameCtl.hasError('required')">
              Filename has to <strong>start [a-zA-Z] char and length is 3~30</strong>
            </mat-error>
            <mat-error *ngIf="exportFilenameCtl.hasError('required')">
              Filename is <strong>required</strong>
            </mat-error>
          </mat-form-field>
          <div mat-dialog-actions>
            <button mat-button type="submit" class="btn btn-default" 
                [disabled]="!exportForm.valid" (click)="onSubmit()" tabindex="2">Submit</button>
            <button mat-button (click)="onCancel()" tabindex="-1" class="btn">Cancel</button>
          </div> 
        </div>   
      </div>
    </div>    
     
    `,
  styles: [`
    div.example-container { 
      width: 700px;
      display: flex;
      flex-direction: row;  
       
    }
    div.example-container div { 
      flex-grow: 1; 
      flex-basis: 250px; 
    }

    .div__export-image-box { 
      background-color: #8e8e8e; 
      flex-basis: 300px;  
      margin-right: 20px; 
      padding: 20px; 
      border: 1px solid #ccc; 
      text-align: center; 
      position: relative;
    }

    .div__export-image-watermark { 
      position: absolute; 
      right: 12px; 
      bottom: 8px;
      font-size: .785rem; 
      color: #585858;  
    }

    img { width: 50%; }
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
