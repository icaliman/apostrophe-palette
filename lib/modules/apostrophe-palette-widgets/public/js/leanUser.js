// Make sure jquery exists before proceeding, this
// code is really for logged in editors only

(function () {
  if (window.$) {
    apos.paletteWidgets = {};
    apos.utils.widgetPlayers['apostrophe-palette'] = function (el, data, options) {
      var $form = $('[data-apos-palette-form]');
      var $tag = $('[data-apos-palette-styles]');
      var schema = apos.modules['apostrophe-palette-widgets'].options.schema;
      var less = apos.modules['apostrophe-palette-widgets'].options.less;
      var piece = _.cloneDeep(apos.modules['apostrophe-palette-widgets'].options.piece);
      init($form, $tag, schema, piece, less);

      // apostrophe-palette interface
      $form.on('click', '[data-apos-palette-group-button]', function (e) {
        e.preventDefault();
        var activeClass = 'apos-palette__group--active';
        var $this = $(this);

        if ($this.parent().hasClass(activeClass)) {
          $this.parent().removeClass(activeClass);
          return;
        }

        $this.parent().siblings('.apos-palette__group').each(function () {
          var $self = $(this);
          $self.removeClass(activeClass);
          $self.find('.apos-palette__group').removeClass(activeClass);
        });

        $this.parent().addClass(activeClass);

      });
    };

    // One debounced save function for each field.
    // If we didn't break them out this way then saves
    // for different fields around the same time might
    // never happen.
    apos.paletteWidgets.debouncedSaves = {};
  }

  function init($form, $tag, schema, piece, less) {
    return apos.schemas.populate($form, schema, piece, function (err) {
      if (err) {
        apos.notify('A problem populating/enhancing the palette field', {
          type: 'error',
          dismiss: true
        });
        return;
      }

      listen($form, $tag, schema, piece, less);

    });
  };

  // Listen for changes to form elements within the palette tool
  function listen($form, $tag, schema, piece, less) {
    $form.find(':input:not([data-apos-workflow-field-state-control])').change(function () {
      var $field = $(this).parents('[data-apos-palette-field]');
      var fieldValue = $field.find(':input:not([data-apos-workflow-field-state-control])').val();
      var fieldSchema = _.find(schema, function (field) {
        if ($field.attr('data-name') === field.name) {
          return field;
        }
      });
      submit($field, fieldValue, fieldSchema, $tag, less);
    });
  };

  // Handles prepping the current front end for changes as well as sending
  // updates to the apostrophe-global piece
  function submit($field, fieldValue, fieldSchema, $tag, less) {
    if (!less) {
      apply($field, fieldValue, fieldSchema, $tag);
    }
    var saveField = apos.paletteWidgets.debouncedSaves[fieldSchema.name];
    if (!saveField) {
      saveField = _.debounce(save, 250, {
        leading: true,
        trailing: true
      });
      apos.paletteWidgets.debouncedSaves[fieldSchema.name] = saveField;
    }
    saveField($field, fieldValue, fieldSchema, $tag, less);
  };

  // Append new CSS rule to the end of our generated stylesheet. Last rule wins!
  function apply($field, fieldValue, fieldSchema, $tag) {
    var selector = $field.attr('data-apos-palette-selector');
    var property = $field.attr('data-apos-palette-property');
    var mediaQuery = $field.attr('data-apos-palette-media-query');
    var unit = $field.attr('data-apos-palette-unit') || '';
    var valueTemplate = $field.attr('data-apos-value-template') || false;
    var value = $field.find(':input:not([data-apos-workflow-field-state-control])').val();

    if (!value) {
      return;
    }

    if (selector && property) {
      property = property.split(',');
      _.each(property, function (prop) {
        var rule = '';
        if (mediaQuery) {
          rule = '@media ' + mediaQuery + ' { ';
        }

        if (valueTemplate) {
          var regex = /%VALUE%/gi;
          rule = rule + selector + ' { ' + prop + ': ' + valueTemplate.replace(regex, value + unit) + '; } ';
        } else {
          rule = rule + selector + ' { ' + prop + ': ' + value + unit + '; } ';
        }

        if (mediaQuery) {
          rule = rule + ' }';
        }
        $tag.append(rule);
      });
    }
  };

  // Reload CSS file
  function reloadCss() {
    var $link = $('[data-apos-palette-link]');
    var url = $link.attr('href').split('?v=')[0];

    $link.attr('href', url + '?v=' + Date.now());
  }

  function save($field, fieldValue, fieldSchema, $tag, less) {
    // build an object of data from the palette field to update the apostrophe-global piece with
    var save = {};
    save.field = {
      name: fieldSchema.name,
      value: $field.find(':input:not([data-apos-workflow-field-state-control])').val()
    };
    save._id = apos.modules['apostrophe-palette-widgets'].options.piece._id;

    return send(function (err) {
      if (err) {
        apos.notify('Something was not right. Please review your submission.', {
          type: 'error',
          dismiss: true
        });
      }

      if (less) {
        reloadCss();
      }
    });

    // send the update back to the server
    function send(callback) {
      apos.utils.post('/modules/apostrophe-palette-widgets/palette-update', save, function (err, res) {
        if (err) {
          return callback('error');
        }
        if (apos.emit) {
          apos.emit('workflowModified');
        }
        return callback(null);
      });
    }
  }
})();