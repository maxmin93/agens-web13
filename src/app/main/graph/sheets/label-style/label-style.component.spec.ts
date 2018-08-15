import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LabelStyleComponent } from './label-style.component';

describe('LabelStyleComponent', () => {
  let component: LabelStyleComponent;
  let fixture: ComponentFixture<LabelStyleComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LabelStyleComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LabelStyleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
