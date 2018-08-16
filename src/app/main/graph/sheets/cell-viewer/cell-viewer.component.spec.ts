import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CellViewerComponent } from './cell-viewer.component';

describe('CellViewerComponent', () => {
  let component: CellViewerComponent;
  let fixture: ComponentFixture<CellViewerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CellViewerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CellViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
