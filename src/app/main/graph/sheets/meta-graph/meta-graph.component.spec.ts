import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MetaGraphComponent } from './meta-graph.component';

describe('MetaGraphComponent', () => {
  let component: MetaGraphComponent;
  let fixture: ComponentFixture<MetaGraphComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MetaGraphComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MetaGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
