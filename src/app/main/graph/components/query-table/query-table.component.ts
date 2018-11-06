import { Component, OnInit, AfterViewInit, Input, ViewChild, ChangeDetectorRef } from '@angular/core';

import { MatBottomSheet, MatBottomSheetRef } from '@angular/material';
import { DatatableComponent, ColumnMode } from '@swimlane/ngx-datatable';

import { CellViewerComponent } from '../../sheets/cell-viewer/cell-viewer.component';

import { IRecord, IColumn, IRow } from '../../../../models/agens-data-types';
import * as CONFIG from '../../../../app.config';

@Component({
  selector: 'app-query-table',
  templateUrl: './query-table.component.html',
  styleUrls: ['./query-table.component.scss','../../graph.component.scss']
})
export class QueryTableComponent implements OnInit, AfterViewInit {

  @Input() data:IRecord;

  record:IRecord;
  recordColumns: IColumn[] = [];
  recordRows: IRow[] = [];
  recordRowsCount: number = 0;
  isJsonCell: boolean = false;

  selected: any[] = [];
  selectedCell: any = {};
  selectedRowIndex: number = -1;
  selectedColIndex: number = -1;

  @ViewChild('recordTable') recordTable: DatatableComponent;

  constructor(
    private _cd: ChangeDetectorRef,
    private _sheet: MatBottomSheet
  ) { }

  ngOnInit() {
  }

  ngAfterViewInit(){
    this.recordTable.columnMode = ColumnMode.force;
  }

  /////////////////////////////////////////////////////////////////
  // Table Controllers
  /////////////////////////////////////////////////////////////////

  // 결과들만 삭제 : runQuery 할 때 사용
  clear(){
    // 테이블 비우고
    this.recordRowsCount = 0;
    this.recordRows = [];
    this.recordColumns = [];

    this.selectedCell = {};
    this.selectedRowIndex = -1;
    this.selectedColIndex = -1;

    // change Detection by force
    this._cd.detectChanges();
  }

  setData(record:IRecord){
    // console.log( record );
    this.record = record;
    this.recordColumns = [...record.columns];
    this.recordRows = this.convertRowToAny(this.recordColumns, record.rows);
    this.recordRowsCount = this.recordRows.length;
  }

  refresh(){
    // this.recordColumns = [...this.record.columns];
    this.recordTable.columnMode = ColumnMode.flex;
    // **NOTE: tab 에 의해 가려진 이후에 refresh 필요!!
    this.recordRows = [...this.recordRows];           
    setTimeout(()=>{ 
      this.recordTable.recalculate();
      this._cd.detectChanges();
    }, 10);
  }

  // rows를 변환 : Array<Array<any>> ==> Array<Map<string,any>>
  // **NOTE: key 를 name 으로 할 경우 같은 이름의 컬럼에 대해 overwrite 가 된다!!
  convertRowToAny(columns:IColumn[], rows:IRow[]):any[]{
    let tempArray: any[] = [];
    for( let row of rows ){
      let temp:any = {};
      for( let col of columns ){
        // key: col.name; <== when same names exist, overwrite values
        temp[col.index] = <any> row.row[col.index];
      }
      tempArray.push(temp);
    }
    return tempArray;
  }

  // table 컬럼 정렬 기능은 제거
  // ** 이유
  // 1) JSON 형태에 대해서 정렬 안됨 : Node, Edge, Graph 등
  // 2) record 크기가 1000개 이상이면 브라우저 성능상 부하 가능 ==> order by 구문으로 처리하도록 유도
  // recordSort(col:IColumn){
  //   console.log('recordSort =>', col);
  // }

  // onSelect(event) {
  //   console.log('Event: select', this.recordColumns, this.selected);
  //   this.openBottomSheet();
  // }

  onSelectCell(col:IColumn, cell:any) {
    // console.log('select-cell:', col, cell);
    this.openBottomSheet(col, cell);
  }

  openBottomSheet(col:IColumn, cell:any): void {
    const bottomSheetRef = this._sheet.open(CellViewerComponent, {
      ariaLabel: 'Json viewer',
      panelClass: 'sheet-cell-viewer',
      data: { type: col.type, value: cell }
    });

    bottomSheetRef.afterDismissed().subscribe(() => {
      // console.log('Bottom sheet has been dismissed.');
    });
  }

}
