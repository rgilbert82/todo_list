// ============================================================================
//  Todo List App
// ============================================================================

var MONTHS = {
  '01': 'Jan',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Apr',
  '05': 'May',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Aug',
  '09': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Dec'
};

var $head = $('#head');
var $addTodo = $('#add_todo');
var $allTodos = $('#all_todos ul');
var $allTodosHeader = $('#all_todos h2 a');
var $allTodosHeaderTotal = $('#all_todos .sidebar_header_total');
var $completed = $('#completed ul');
var $completedHeader = $('#completed h2 a');
var $completedHeaderTotal = $('#completed .sidebar_header_total');
var $todosList = $('#col2 ul');
var $modals = $('#modal_container');

// ============================================================================
//  Model
// ============================================================================

var TodoList = {
  todos: [],
  todoID: 0,
  incrementTodoID: function() {
    this.todoID++;
  },
  resetTodoID: function() {
    if (this.todos.length === 0) {
      this.todoID = 0;
    }
  },
  getFormObject: function($f) {
    var obj = {};

    $f.serializeArray().forEach(function(input) {
      obj[input.name] = input.value.trim();
    });

    this.addTodoID(obj);
    this.addCompletedStatus(obj);
    this.addFormattedDate(obj);

    return obj;
  },
  addCompletedStatus: function(dataObj) {
    if (dataObj.is_complete) {
      dataObj.is_complete = true;
    }
  },
  addTodoID: function(dataObj) {
    if (!dataObj.id) {
      this.incrementTodoID();
      dataObj.id = this.todoID;
    } else if (typeof dataObj.id === 'string') {
      dataObj.id = Number(dataObj.id);
    }
  },
  addFormattedDate: function(dataObj) {
    if (dataObj.month && dataObj.year) {
      dataObj.date = dataObj.month + "/" + dataObj.year.slice(2);
    } else {
      dataObj.date = 'No Due Date';
    }
  },
  writeTodo: function(target) {
    var data = this.getFormObject(target);

    this.todos = this.todos.filter(function(todo) {
      return todo.id !== data.id;
    });

    this.todos.push(data);
  },
  deleteTodo: function($target) {
    var todoID = Number($target.closest('li').attr('data-id'));

    this.todos = this.todos.filter(function(todo) {
      return todo.id !== todoID;
    });
  },
  changeCompletedStatus: function($target) {
    var todoID = Number($target.closest('li').attr('data-id'));

    this.todos.forEach(function(todo) {
      if (todo.id === todoID && todo.is_complete) {
        delete todo.is_complete;
      } else if (todo.id === todoID && !todo.is_complete){
        todo.is_complete = true;
      }
    });
  },
};

// ============================================================================
//  Controller
// ============================================================================

var TodoApp = {
  instantiateTodoList: function() {
    this.todoList = Object.create(TodoList)
  },
  instantiateViews: function() {
    this.primaryColumnView = Object.create(PrimaryColumnView).init(this);
    this.todosSidebarView = Object.create(TodosSidebarView).init(this);
  },
  storeTodoID: function() {
    localStorage.setItem('todoID', JSON.stringify(this.todoList.todoID));
  },
  storeTodos: function() {
    localStorage.setItem('todos', JSON.stringify(this.todoList.todos));
  },
  setupLocalStorage: function() {
    localStorage.todoID || this.storeTodoID();
    localStorage.todos  || this.storeTodos();

    this.todoList.todoID =  JSON.parse(localStorage.todoID);
    this.todoList.todos =   JSON.parse(localStorage.todos);
  },
  storeAndReset: function() {
    this.todoList.resetTodoID();
    this.storeTodoID();
    this.storeTodos();
    this.todosSidebarView.refreshPage();
  },
  submitForm: function(e) {
    var todoList = this.todoList;
    var $target = $(e.currentTarget);

    e.preventDefault();

    todoList.writeTodo($target);
    this.primaryColumnView.closeModal();
    this.storeAndReset();
  },
  init: function() {
    this.instantiateTodoList();
    this.setupLocalStorage();
    this.instantiateViews(app);
    $allTodosHeader.trigger('click');
  },
};

// ============================================================================
//  Shared View Functions
// ============================================================================

function orderByNoDueDate(todos) {
  return todos.sort(function(a, b) {
    if(a.date === 'No Due Date') {
      return -1;
    } else if (b.date === 'No Due Date') {
      return 1;
    } else {
      return 0;
    }
  });
}

function orderByDate(datesTotals) {
  return orderByNoDueDate(datesTotals.sort(function(a, b) {
    return a.date.split('/').reverse().join('') > b.date.split('/').reverse().join('');
  }));
}

function orderByDay(todos) {
  return orderByNoDueDate(todos.sort(function(a, b) {
    return a.year + a.month + a.day > b.year + b.month + b.day;
  }));
}

function orderByDayCompleted(todos) {
  var ordered = orderByDay(todos);
  var completed = ordered.filter(function(todo) { return todo.is_complete });
  var notCompleted = ordered.filter(function(todo) { return !todo.is_complete });

  return notCompleted.concat(completed);
}

// ============================================================================
//  Views
// ============================================================================

var TodosSidebarView = {
  createTemplates: function() {
    this.sidebarHeaderTemplate = Handlebars.compile($('#sidebar_header_template').remove().html());
    this.allTodosSidebarTemplate = Handlebars.compile($('#all_todos_sidebar_template').remove().html());
    this.allTodosSidebarPartial = Handlebars.compile($('#all_todos_sidebar_partial').html());
    this.completedSidebarTemplate = Handlebars.compile($('#completed_sidebar_template').remove().html());
    this.completedSidebarPartial = Handlebars.compile($('#completed_sidebar_partial').html());

    Handlebars.registerPartial('all_todos_sidebar_partial', $('#all_todos_sidebar_partial').remove().html());
    Handlebars.registerPartial('completed_sidebar_partial', $('#completed_sidebar_partial').remove().html());
  },
  getViewModel: function() {
    var allTodos = 0;
    var allCompleted = 0;
    var datesTotals = this.getDatesTotals();

    datesTotals.forEach(function(dt) {
      allTodos += dt.totalNumber;
      allCompleted += dt.completedNumber;
    });

    this.viewModel = { allTodos: allTodos, allCompleted: allCompleted, rows: datesTotals };
  },
  getDatesTotals: function() {
    var datesTotals = [];

    this.app.todoList.todos.forEach(function(d) {
      var findDate = datesTotals.map(function(dt) {
        return dt.date === d.date;
      });
      var index = findDate.indexOf(true);
      var completed = d.is_complete ? 1 : 0;

      if (index === -1) {
        datesTotals.push({ date: d.date, totalNumber: 1, completedNumber: completed });
      } else {
        datesTotals[index].totalNumber++;
        datesTotals[index].completedNumber += completed;
      }
    });

    datesTotals.map(function(dt) {
      if (dt.totalNumber === dt.completedNumber) {
        dt.allCompleted = true;
      } else {
        dt.allCompleted = false;
      }
    });

    return orderByDate(datesTotals);
  },
  populateAllTodosList: function() {
    $allTodosHeaderTotal.html(this.sidebarHeaderTemplate({ total: this.viewModel.allTodos }));
    $allTodos.html(this.allTodosSidebarTemplate({ month: this.viewModel.rows }));
  },
  populateCompletedList: function() {
    var completedDatesTotals = this.viewModel.rows.filter(function(dt) { return dt.completedNumber > 0 });

    if (this.viewModel.allTodos > 0 && this.viewModel.allTodos === this.viewModel.allCompleted) {
      $completedHeader.addClass('strikethrough');
    } else {
      $completedHeader.removeClass('strikethrough');
    }

    $completedHeaderTotal.html(this.sidebarHeaderTemplate({ total: this.viewModel.allCompleted }));
    $completed.html(this.completedSidebarTemplate({ month: completedDatesTotals }));
  },
  populateSidebarLists: function() {
    this.getViewModel();
    this.populateAllTodosList();
    this.populateCompletedList();
  },
  highlightSidebar: function(target) {
    $('body').find('.current_page').removeClass('current_page');
    target.addClass('current_page');
  },
  refreshPage: function() {
    var highlightedAttr = $('#col1').find('.current_page').attr('data-highlight');
    var toHighlight = '[data-highlight="' + highlightedAttr + '"]';
    var sidebarView = this.app.sidebarView;

    this.populateSidebarLists();

    if ($(toHighlight).length > 0) {
      $(toHighlight).find('a').trigger('click');
    } else {
      $allTodosHeader.trigger('click');
    }
  },
  bindEvents: function() {
    var primaryColumnView = this.app.primaryColumnView;

    $allTodos.on('click', 'li a', primaryColumnView.populatePrimaryColumnByDateAll.bind(primaryColumnView));
    $allTodosHeader.on('click', primaryColumnView.populatePrimaryColumnByAllTodos.bind(primaryColumnView));
    $completed.on('click', 'li a', primaryColumnView.populatePrimaryColumnByDateCompleted.bind(primaryColumnView));
    $completedHeader.on('click', primaryColumnView.populatePrimaryColumnByAllCompleted.bind(primaryColumnView));
  },
  init: function(app) {
    this.app = app;
    this.createTemplates();
    this.populateSidebarLists();
    this.bindEvents();
    return this;
  }
};

var PrimaryColumnView = {
  createTemplates: function() {
    this.modalTemplate = Handlebars.compile($('#modal_template').remove().html());
    this.primaryColumnHeaderTemplate = Handlebars.compile($('#primary_column_header_template').remove().html());
    this.primaryColumnTodoTemplate = Handlebars.compile($('#primary_column_todo_template').remove().html());
    this.primaryColumnTodoPartial = Handlebars.compile($('#primary_column_todo_partial').html());

    Handlebars.registerPartial('primary_column_todo_partial', $('#primary_column_todo_partial').remove().html());

    Handlebars.registerHelper('select_year', function(year, option) {
      return year === option ? ' selected' : '';
    });

    Handlebars.registerHelper('select_month', function(month, option) {
      return month === option ? ' selected' : '';
    });

    Handlebars.registerHelper('select_day', function(day, option) {
      return day === option ? ' selected' : '';
    });

    Handlebars.registerHelper('date_or_no_date', function(day, month, year) {
      if (day && month && year) {
        return day + ' ' + MONTHS[month] + ' ' + year;
      } else if (month && year) {
        return MONTHS[month] + ' ' + year;
      } else {
        return 'No Due Date';
      }
    });
  },
  openAddTodoModal: function(e) {
    e.preventDefault();

    $modals.append(this.modalTemplate({}));
    $modals.find('#modal').fadeIn();
  },
  openEditTodoModal: function(e) {
    var id = Number($(e.currentTarget).closest('li').attr('data-id'));
    var todoObj = this.app.todoList.todos.filter(function(todo) { return todo.id === id})[0];

    e.preventDefault();

    $modals.append(this.modalTemplate(todoObj));
    $modals.find('#modal').fadeIn();
  },
  closeModal: function(e) {
    var $modal = $modals.find('div');

    $modal.fadeOut();
    setTimeout( function() { $modal.remove() }, 400);
  },
  deleteTodo: function(e) {
    var $target = $(e.currentTarget);
    var todoList = this.app.todoList;

    e.preventDefault();

    todoList.deleteTodo($target);
    this.app.storeAndReset();
  },
  changeCheckboxText: function(e) {
    var $checkbox = $(e.currentTarget);

    if ($checkbox[0].checked) {
      $(e.currentTarget).siblings('label').text('Mark As Incomplete');
    } else {
      $(e.currentTarget).siblings('label').text('Mark As Complete');
    }
  },
  changeCompletedStatusWithCheckbox: function(e) {
    var todoList = this.app.todoList;
    var $target = $(e.currentTarget);

    todoList.changeCompletedStatus($target);
    this.app.storeAndReset();
  },
  populatePrimaryColumnByDateAll: function(e) {
    var selectedDate = $(e.currentTarget).text();
    var todoList = this.app.todoList;
    var sidebarView = this.app.todosSidebarView;
    var rows = sidebarView.viewModel.rows;
    var todosForDate = orderByDayCompleted(todoList.todos.filter(function(d) {
      return d.date === selectedDate;
    }));
    var todosForDateTotal = rows.filter(function(dt) {
      return dt.date === selectedDate;
    })[0].totalNumber;
    var headerObj = { date: selectedDate, total: todosForDateTotal };

    e.preventDefault();

    sidebarView.highlightSidebar($(e.currentTarget).closest('li'));
    this.renderPrimaryHeader(headerObj);
    this.populatePrimaryColumn(todosForDate);
  },
  populatePrimaryColumnByDateCompleted: function(e) {
    var selectedDate = $(e.currentTarget).text();
    var todoList = this.app.todoList;
    var sidebarView = this.app.todosSidebarView;
    var rows = sidebarView.viewModel.rows;
    var completedTodosForDate = orderByDayCompleted(todoList.todos.filter(function(d) {
      return d.date === selectedDate && d.is_complete;
    }));
    var completedTodosForDateTotal = rows.filter(function(dt) {
      return dt.date === selectedDate;
    })[0].completedNumber;
    var headerObj = { date: selectedDate, total: completedTodosForDateTotal };

    e.preventDefault();

    sidebarView.highlightSidebar($(e.currentTarget).closest('li'));
    this.renderPrimaryHeader(headerObj);
    this.populatePrimaryColumn(completedTodosForDate);
  },
  populatePrimaryColumnByAllTodos: function(e) {
    var todoList = this.app.todoList;
    var sidebarView = this.app.todosSidebarView;
    var allTodos = orderByDayCompleted(todoList.todos);
    var headerObj = { date: 'All Todos', total: allTodos.length };

    e.preventDefault();

    sidebarView.highlightSidebar($(e.currentTarget).closest('dl'));
    this.renderPrimaryHeader(headerObj);
    this.populatePrimaryColumn(allTodos);
  },
  populatePrimaryColumnByAllCompleted: function(e) {
    var todoList = this.app.todoList;
    var sidebarView = this.app.todosSidebarView;
    var allCompleted = orderByDayCompleted(todoList.todos.filter(function(todo) {
      return todo.is_complete;
    }));
    var headerObj = { date: 'All Completed Todos', total: allCompleted.length };

    e.preventDefault();

    sidebarView.highlightSidebar($(e.currentTarget).closest('dl'));
    this.renderPrimaryHeader(headerObj);
    this.populatePrimaryColumn(allCompleted);
  },
  populatePrimaryColumn: function(todos) {
    $todosList.html(this.primaryColumnTodoTemplate({ todo: todos }));
  },
  renderPrimaryHeader: function(headerObj) {
    $head.html(this.primaryColumnHeaderTemplate(headerObj));
  },
  bindEvents: function() {
    var todoList = this.app.todoList;

    $modals.on('click', '.modal_layer', this.closeModal.bind(this));
    $modals.on('submit', 'form', this.app.submitForm.bind(this.app));
    $modals.on('change', ':checkbox', this.changeCheckboxText.bind(this));
    $addTodo.on('click', this.openAddTodoModal.bind(this));
    $todosList.on('click', 'li label', this.openEditTodoModal.bind(this));
    $todosList.on('click', 'a', this.deleteTodo.bind(this));
    $todosList.on('click', '.todo_checkbox', this.changeCompletedStatusWithCheckbox.bind(this));
  },
  init: function(app) {
    this.app = app;
    this.createTemplates();
    this.bindEvents();
    return this;
  }
};


var app = Object.create(TodoApp);
app.init();
