import React from 'react';
import PropTypes from 'prop-types';
import QueryAssist from '@jetbrains/ring-ui/components/query-assist/query-assist';
import Input, {Size as InputSize} from '@jetbrains/ring-ui/components/input/input';
import Select from '@jetbrains/ring-ui/components/select/select';
import Link from '@jetbrains/ring-ui/components/link/link';
import {Tabs, Tab} from '@jetbrains/ring-ui/components/tabs/tabs';
import LoaderInline from '@jetbrains/ring-ui/components/loader-inline/loader-inline';
import {i18n} from 'hub-dashboard-addons/dist/localization';
import HttpErrorHandler from '@jetbrains/hub-widget-ui/dist/http-error-handler';
import RefreshPeriod from '@jetbrains/hub-widget-ui/dist/refresh-period';
import ConfigurationForm from '@jetbrains/hub-widget-ui/dist/configuration-form';
import '@jetbrains/ring-ui/components/form/form.scss';


import ServiceResource from './components/service-resource';
import {
  underlineAndSuggest,
  loadIssues,
  loadPinnedIssueFolders,
  loadFieldsWithType
} from './resources';
import './style/widget.scss';

const MIN_YOUTRACK_VERSION = '2017.4.38723';

class EditForm extends React.Component {
  static propTypes = {
    search: PropTypes.string,
    context: PropTypes.object,
    title: PropTypes.string,
    startScheduleField: PropTypes.string,
    scheduleField: PropTypes.string,
    colorField: PropTypes.string,
    refreshPeriod: PropTypes.number,
    onSubmit: PropTypes.func,
    onCancel: PropTypes.func,
    dashboardApi: PropTypes.object,
    youTrackId: PropTypes.string
  };

  static FILTERS_TYPES = {
    PROJECTS: 0,
    TAGS: 1,
    SEARCHES: 2
  };

  static EVERYTHING_CONTEXT_OPTION = {
    id: '-1',
    label: i18n('Everything')
  };

  static REFRESH_PERIOD_MINUTE = 60; // eslint-disable-line no-magic-numbers

  constructor(props) {
    super(props);

    const selectedYouTrack = {
      id: props.youTrackId
    };
    this.state = {
      search: props.search || '',
      context: props.context,
      title: props.title || '',
      startScheduleField: props.startScheduleField,
      scheduleField: props.scheduleField,
      colorField: props.colorField,
      refreshPeriod: props.refreshPeriod || 0,
      selectedYouTrack,
      youTracks: [selectedYouTrack],
      filtersType: EditForm.FILTERS_TYPES.PROJECTS,
      availableScheduleFields: [],
      availableEventFields: []
    };
  }

  componentDidMount() {
    this.loadYouTrackList();
    this.onAfterYouTrackChanged();
  }

  setFormLoaderEnabled(isLoading) {
    this.setState({isLoading});
    if (isLoading) {
      this.setState({noConnection: false});
    }
  }

  async loadYouTrackList() {
    const {selectedYouTrack} = this.state;
    const youTracks = await ServiceResource.getYouTrackServices(
      this.props.dashboardApi.fetchHub, MIN_YOUTRACK_VERSION
    );
    const selectedYouTrackWithAllFields =
      youTracks.filter(yt => yt.id === selectedYouTrack.id)[0];
    this.setState({
      youTracks, selectedYouTrack: selectedYouTrackWithAllFields
    });
  }

  async onAfterYouTrackChanged() {
    this.setFormLoaderEnabled(true);
    try {
      await this.loadAllContexts();
      await this.loadAllScheduleFields();
      await this.loadAllEventFields();
    } catch (err) {
      this.setState({
        isLoading: false,
        errorMessage: HttpErrorHandler.getMessage(
          err,
          i18n('Selected YouTrack service is not available')
        )
      });
      return;
    }
    this.setFormLoaderEnabled(false);
  }

  changeFiltersType = filtersType =>
    this.setState({filtersType});

  changeSearch = search => {
    this.setState({search, errorMessage: ''});
  };

  appendToSearch = (filterType, filter) => {
    const {search, context} = this.state;
    if (!search && !context) {
      this.setState({context: filter});
    } else {
      const trimmedSearch = (search || '').replace(/\s+$/g, '');
      const newSearch = trimmedSearch ? `${trimmedSearch} ${filter.query}` : `${filter.query}`;
      this.setState({search: newSearch});
    }
  };

  changeTitle = evt =>
    this.setState({title: evt.target.value});

  clearTitle = () => this.setState({title: ''});

  changeScheduleField = evt => {
    this.setState({scheduleField: evt.label});
  };

  changeStartScheduleField = evt => {
    this.setState({startScheduleField: evt.label});
  };

  changeColorField = evt => {
    this.setState({colorField: evt.label});
  };

  clearScheduleField = () => {
    this.setState({scheduleField: ''});
  };

  changeYouTrack = selected => {
    this.setState({
      selectedYouTrack: selected.model,
      errorMessage: ''
    }, () => this.onAfterYouTrackChanged());
  };

  submitForm = async () => {
    const {
      search,
      context,
      title,
      refreshPeriod,
      selectedYouTrack,
      startScheduleField,
      scheduleField,
      colorField
    } = this.state;
    this.setFormLoaderEnabled(true);
    try {
      await loadIssues(
        async (url, params) => this.fetchYouTrack(url, params), search, context
      );
    } catch (err) {
      this.setState({
        isLoading: false,
        errorMessage: HttpErrorHandler.getMessage(err)
      });
      return;
    }
    this.setFormLoaderEnabled(false);

    const isDateAndTime =
        this.state.dateTimeFields.map(i => i.name).includes(scheduleField);

    await this.props.onSubmit({
      search: search || '',
      title,
      context,
      refreshPeriod,
      selectedYouTrack,
      startScheduleField,
      scheduleField,
      colorField,
      isDateAndTime
    });
  };

  fetchYouTrack = async (url, params) => {
    const {dashboardApi} = this.props;
    const {selectedYouTrack} = this.state;
    return await dashboardApi.fetch(selectedYouTrack.id, url, params);
  };

  underlineAndSuggest = async (query, caret) =>
    await underlineAndSuggest(this.fetchYouTrack, query, caret);

  changeSearchContext = selected => this.setState({context: selected.model});

  loadAllContexts = async () => {
    this.setState({allContexts: null});
    const allContexts = await loadPinnedIssueFolders(this.fetchYouTrack, true);
    this.setState({allContexts});
  };

  loadAllScheduleFields = async () => {
    this.setState({availableScheduleFields: []});

    const dateFields = await loadFieldsWithType(this.fetchYouTrack, 'date');
    const dateTimeFields =
        await loadFieldsWithType(this.fetchYouTrack, 'date and time');

    const fields = [
      ...dateFields,
      ...dateTimeFields
    ];

    const availableScheduleFields = [];
    fields.forEach(field => {
      availableScheduleFields.push({label: field.name});
    });
    this.setState({availableScheduleFields, dateFields, dateTimeFields});
  };

  loadAllEventFields = async () => {
    this.setState({availableEventFields: []});
    const fields = await loadFieldsWithType(this.fetchYouTrack, 'enum[1]');
    const availableEventFields = [];
    fields.forEach(field => {
      availableEventFields.push({label: field.name});
    });
    this.setState({availableEventFields});
  };

  renderFilterLink(filterType, filter) {
    const appendToQuery = () => this.appendToSearch(filterType, filter);

    return (
      <div
        key={`filter-${filter.id}`}
        className="issues-list-widget__filter"
      >
        <Link
          pseudo={true}
          onClick={appendToQuery}
        >
          {
            filter.shortName
              ? `${filter.name} (${filter.shortName})`
              : filter.name
          }
        </Link>
      </div>
    );
  }

  renderFiltersList(filtersType) {
    const {allContexts, context, search} = this.state;

    const checkFilterType = (stringType, folder) =>
      (folder.$type || '').toLowerCase().indexOf(stringType) > -1;
    const isProject = checkFilterType.bind(null, 'project');
    const isTag = checkFilterType.bind(null, 'tag');
    const isSavedSearch = checkFilterType.bind(null, 'savedquery');

    const filterTypeCheckers = [
      isProject, isTag, isSavedSearch
    ];

    const noFiltersMessages = [
      i18n('No projects'),
      i18n('No tags'),
      i18n('No saved searches')
    ];
    // eslint-disable-next-line max-len
    const displayedFilters = (allContexts || []).filter(filterTypeCheckers[filtersType]).filter(filterIsNotAlreadyUsed);

    return (
      <div className="issues-list-widget__filters-list">
        {
          (!allContexts) && <LoaderInline/>
        }
        {
          displayedFilters.length === 0 &&
          <span className="issues-list-widget__no-filters">
            {noFiltersMessages[filtersType]}
          </span>
        }
        {
          displayedFilters.length > 0 && displayedFilters.map(
            filter => this.renderFilterLink(filtersType, filter)
          )
        }
      </div>
    );

    // eslint-disable-next-line complexity
    function filterIsNotAlreadyUsed(filter) {
      if (filter.id === (context || {}).id) {
        return false;
      }
      const trimmedSearch = (search || '').replace(/\s+$/g, '');
      const startPosition = trimmedSearch.indexOf(filter.query);
      if (startPosition === -1) {
        return true;
      }
      const endPosition = startPosition + filter.query.length;
      if (startPosition !== 0 && trimmedSearch[startPosition - 1] !== ' ') {
        return true;
      }
      return !(endPosition === trimmedSearch.length ||
        trimmedSearch[endPosition] === ' ');
    }
  }

  renderFilteringSettings() {
    const {
      search,
      context,
      filtersType,
      allContexts
    } = this.state;

    const queryAssistDataSource = async queryAssistModel =>
      await this.underlineAndSuggest(
        queryAssistModel.query, queryAssistModel.caret
      );

    const toSelectItem = it => it && {key: it.id, label: it.name, model: it};

    const onQueryAssistChange = queryAssistModel =>
      this.changeSearch(queryAssistModel.query);

    const contextOptions = (allContexts || []).map(toSelectItem);
    contextOptions.unshift(EditForm.EVERYTHING_CONTEXT_OPTION);

    return (
      <div>
        <div>
          <Select
            className="issues-list-widget__search-context"
            type={Select.Type.BUTTON}
            size={InputSize.S}
            data={contextOptions}
            selected={toSelectItem(context)}
            onSelect={this.changeSearchContext}
            filter={true}
            loading={!allContexts}
            label={i18n('Everything')}
          />
          <div className="issues-list-widget__search-query">
            <QueryAssist
              disabled={this.state.isLoading}
              query={search}
              placeholder={i18n('Type search query')}
              onChange={onQueryAssistChange}
              dataSource={queryAssistDataSource}
            />
          </div>
        </div>
        <div className="issues-list-widget__filters-switcher">
          <Tabs
            selected={`${filtersType}`}
            onSelect={this.changeFiltersType}
          >
            <Tab
              id={`${EditForm.FILTERS_TYPES.PROJECTS}`}
              title={i18n('Projects')}
            >
              {this.renderFiltersList(filtersType)}
            </Tab>
            <Tab
              id={`${EditForm.FILTERS_TYPES.TAGS}`}
              title={i18n('Tags')}
            >
              {this.renderFiltersList(filtersType)}
            </Tab>
            <Tab
              id={`${EditForm.FILTERS_TYPES.SEARCHES}`}
              title={i18n('Saved searches')}
            >
              {this.renderFiltersList(filtersType)}
            </Tab>
          </Tabs>
        </div>
      </div>
    );
  }

  renderRefreshPeriod() {
    if (this.state.isLoading || this.state.errorMessage) {
      return '';
    }

    const changeRefreshPeriod = newValue =>
      this.setState({refreshPeriod: newValue});

    return (
      <RefreshPeriod
        seconds={this.state.refreshPeriod}
        onChange={changeRefreshPeriod}
      />
    );
  }

  render() {
    const {
      youTracks,
      selectedYouTrack,
      noConnection,
      errorMessage,
      allContexts
    } = this.state;

    const youTrackServiceToSelectItem = it => it && {
      key: it.id,
      label: it.name,
      description: it.homeUrl,
      model: it
    };

    return (
      <ConfigurationForm
        warning={errorMessage}
        isInvalid={!!errorMessage || !this.state.scheduleField}
        isLoading={this.state.isLoading}
        panelControls={this.renderRefreshPeriod()}
        onSave={this.submitForm}
        onCancel={this.props.onCancel}
      >
        <Input
          className="ring-form__group"
          label="Optional title"
          size={InputSize.FULL}
          value={this.state.title}
          placeholder={i18n('Set optional title')}
          onClear={this.clearTitle}
          onChange={this.changeTitle}
        />
        {
          youTracks.length > 1 &&
          <Select
            className="ring-form__group"
            size={InputSize.FULL}
            maxHeight={300}
            //type={Select.Type.BUTTON}
            selectedLabel="YouTrack service"
            data={youTracks.map(youTrackServiceToSelectItem)}
            selected={youTrackServiceToSelectItem(selectedYouTrack)}
            onSelect={this.changeYouTrack}
            filter={true}
            label={i18n('Select YouTrack')}
          />
        }
        {
          !errorMessage &&
          <Select
            className="ring-form__group"
            selectedLabel="Start Schedule by field"
            size={InputSize.FULL}
            data={this.state.availableScheduleFields}
            selected={{label: this.state.startScheduleField}}
            onSelect={this.changeStartScheduleField}
            filter={true}
            maxHeight={300}
            renderOptimization={false}
            label={i18n('Select Start Schedule field (optional)')}
          />
        }
        {
          !errorMessage &&
          <Select
            className="ring-form__group"
            selectedLabel="Schedule by field"
            size={InputSize.FULL}
            data={this.state.availableScheduleFields}
            selected={{label: this.state.scheduleField}}
            onSelect={this.changeScheduleField}
            filter={true}
            maxHeight={300}
            renderOptimization={false}
            label={i18n('Select Schedule field')}
          />
        }
        {
          !errorMessage &&
          <Select
            className="ring-form__group"
            selectedLabel="Color scheme"
            size={InputSize.FULL}
            data={this.state.availableEventFields}
            selected={{label: this.state.colorField}}
            onSelect={this.changeColorField}
            filter={true}
            maxHeight={300}
            renderOptimization={false}
            label={i18n('Select color scheme field')}
          />
        }
        <div className="ring-form__group">
          {
            !noConnection && allContexts && this.renderFilteringSettings()
          }
          {
            !noConnection && !allContexts && !errorMessage && <LoaderInline/>
          }
        </div>
      </ConfigurationForm>
    );
  }
}


export default EditForm;
