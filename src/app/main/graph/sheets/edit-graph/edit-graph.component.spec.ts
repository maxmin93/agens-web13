import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditGraphComponent } from './edit-graph.component';

describe('EditGraphComponent', () => {
  let component: EditGraphComponent;
  let fixture: ComponentFixture<EditGraphComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EditGraphComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EditGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
