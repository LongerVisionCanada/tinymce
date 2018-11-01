import {
  AddEventsBehaviour,
  AlloyEvents,
  AlloySpec,
  AlloyTriggers,
  Behaviour,
  Composing,
  CustomEvent,
  Focusing,
  FormField,
  Input,
  Invalidating,
  Layout,
  Memento,
  Representing,
  SimpleSpec,
  Tabstopping,
} from '@ephox/alloy';
import { Types } from '@ephox/bridge';
import { Future, Id, Option, Result } from '@ephox/katamari';
import { Css, Element, Traverse } from '@ephox/sugar';

import { UiFactoryBackstageShared } from '../../backstage/Backstage';
import { UiFactoryBackstageForColorInput } from '../../backstage/ColorInputBackstage';
import { renderLabel } from '../alien/FieldLabeller';
import ColorSwatch from '../core/color/ColorSwatch';
import { renderPanelButton } from '../general/PanelButton';

const colorInputChangeEvent = Id.generate('color-change');
const colorSwatchChangeEvent = Id.generate('hex-change');

interface ColorInputChangeEvent extends CustomEvent {
  color: () => string;
}

interface ColorSwatchChangeEvent extends CustomEvent {
  value: () => string;
}

export const renderColorInput = (spec: Types.ColorInput.ColorInput, sharedBackstage: UiFactoryBackstageShared, colorInputBackstage: UiFactoryBackstageForColorInput): SimpleSpec => {
  const pField = FormField.parts().field({
    factory: Input,
    inputClasses: ['tox-textfield'],

    onSetValue: (c) => Invalidating.run(c).get(() => { }),

    inputBehaviours: Behaviour.derive([
      Tabstopping.config({ }),
      Invalidating.config({
        invalidClass: 'tox-textbox-field-invalid',
        getRoot: (comp) => {
          return Traverse.parent(comp.element());
        },
        notify: {
          onValid: (comp) => {
            // onValid should pass through the value here
            // We need a snapshot of the value validated.
            const val = Representing.getValue(comp);
            AlloyTriggers.emitWith(comp, colorInputChangeEvent, {
              color: val
            });
          }
        },
        validator: {
          validateOnLoad: false,
          validate: (input) => {
            const inputValue = Representing.getValue(input);
            // Consider empty strings valid colours
            if (inputValue.length === 0) {
              return Future.pure(Result.value(true));
            } else {
              const span = Element.fromTag('span');
              Css.set(span, 'background-color', inputValue);

              const res = Css.getRaw(span, 'background-color').fold(
                // TODO: Work out what we want to do here.
                () => Result.error('blah'),
                (_) => Result.value(inputValue)
              );

              return Future.pure(res);
            }
          }
        }
      })
    ])
  });

  const pLabel: Option<AlloySpec> = spec.label.map((label) => renderLabel(label, sharedBackstage.providers));

  const emitSwatchChange = (colorBit, value) => {
    AlloyTriggers.emitWith(colorBit, colorSwatchChangeEvent, {
      value
    });
  };

  const onItemAction = (value) => {
    sharedBackstage.getSink().each((sink) => {
      memColorButton.getOpt(sink).each((colorBit) => {
        if (value === 'custom') {
          colorInputBackstage.colorPicker((value) => {
            emitSwatchChange(colorBit, value);
            ColorSwatch.addColor(value);
          }, '#ffffff');
        } else if (value === 'remove') {
          emitSwatchChange(colorBit, '');
        } else {
          emitSwatchChange(colorBit, value);
        }
      });
    });
  };

  const memColorButton = Memento.record(
    renderPanelButton({
      dom: {
        tag: 'span'
      },
      layouts: Option.some({
        onRtl: () => [ Layout.southeast ],
        onLtr: () => [ Layout.southwest ]
      }),
      components: [],
      fetch: ColorSwatch.getFetch(colorInputBackstage.hasCustomColors()),
      onItemAction
    }, sharedBackstage)
  );

  return FormField.sketch({
    dom: {
      tag: 'div',
      classes: ['tox-form__group']
    },
    components: pLabel.toArray().concat([
      {
        dom: {
          tag: 'div',
          classes: ['tox-color-input']
        },
        components: [
          pField,
          memColorButton.asSpec()
        ]
      }
    ]),

    fieldBehaviours: Behaviour.derive([
      AddEventsBehaviour.config('form-field-events', [
        AlloyEvents.run<ColorInputChangeEvent>(colorInputChangeEvent, (comp, se) => {
          memColorButton.getOpt(comp).each((colorButton) => {
            Css.set(colorButton.element(), 'background-color', se.event().color());
          });
        }),
        AlloyEvents.run<ColorSwatchChangeEvent>(colorSwatchChangeEvent, (comp, se) => {
          FormField.getField(comp).each((field) => {
            Representing.setValue(field, se.event().value());
            // Focus the field now that we've set its value
            Composing.getCurrent(comp).each(Focusing.focus);
          });
        })
      ])
    ])
  });
};