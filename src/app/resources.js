const PROJECT_CUSTOM_FIELD_FIELDS = 'id,bundle(id),field(id,name,localizedName,fieldType(id,valueType))';
const ISSUE_FIELD_VALUE_FIELDS = 'id,name,localizedName,login,avatarUrl,name,presentation,minutes,color(id,foreground,background),isResolved';
const ISSUE_FIELD_FIELDS = `id,value(${ISSUE_FIELD_VALUE_FIELDS}),projectCustomField(${PROJECT_CUSTOM_FIELD_FIELDS})`;
const ISSUE_FIELDS = `id,idReadable,summary,resolved,fields(${ISSUE_FIELD_FIELDS})`;

const QUERY_ASSIST_FIELDS = 'query,caret,styleRanges(start,length,style),suggestions(options,prefix,option,suffix,description,matchingStart,matchingEnd,caret,completionStart,completionEnd,group,icon)';
const WATCH_FOLDERS_FIELDS = 'id,$type,name,query,shortName';

export async function loadIssues(fetchYouTrack, query, context, skip) {
  const packSize = 50;
  const encodedQuery = encodeURIComponent(query);
  if (context && context.id) {
    return await fetchYouTrack(
      `api/issueFolders/${context.id}/sortOrder/issues?fields=${ISSUE_FIELDS}&query=${encodedQuery}&$top=${packSize}&$skip=${skip || 0}`
    );
  }
  return await fetchYouTrack(
    `api/issues?fields=${ISSUE_FIELDS}&query=${encodedQuery}&$top=${packSize}&$skip=${skip || 0}`
  );
}

export async function loadTotalIssuesCount(
  fetchYouTrack, query, context
) {
  const issues = await loadQueryHasIssues(fetchYouTrack, query);
  const searchPage = await fetchYouTrack(
    'api/searchPage?fields=total', {
      method: 'POST',
      body: {
        pageSize: 0,
        folder: context && context.id && {
          id: context.id,
          $type: context.$type
        },
        query,
        issue: {id: issues[0].id}
      }
    }
  );
  return searchPage && searchPage.total;
}

export async function loadQueryHasIssues(fetchYouTrack, query) {
  return await fetchYouTrack(`api/issues?q=${query}&$top=1`);
}

export async function loadPinnedIssueFolders(fetchYouTrack, loadAll) {
  const packSize = 100;
  return await fetchYouTrack(`api/userIssueFolders?fields=${WATCH_FOLDERS_FIELDS}&$top=${loadAll ? -1 : packSize}`);
}

export async function underlineAndSuggest(fetchYouTrack, query, caret) {
  return await fetchYouTrack(`api/search/assist?fields=${QUERY_ASSIST_FIELDS}`, {
    method: 'POST',
    body: {query, caret}
  });
}

export async function loadFieldsWithType(fetchYouTrack, fieldType) {
  return await fetchYouTrack(`api/filterFields?$top=-1&fieldTypes=${fieldType}&fields=name`);
}

export async function loadFieldsWithTypeAndName(fetchYouTrack, fieldType, fieldName) {
  return await fetchYouTrack(`api/filterFields?$top=-1&fieldTypes=${fieldType}&name=${fieldName}&fields=name`);
}

export async function loadFirstDayOfWeek(fetchYouTrack) {
  const profile = await fetchYouTrack('api/admin/users/me?$top=-1&fields=profiles(appearance(firstDayOfWeek))');
  return profile.profiles.appearance.firstDayOfWeek;
}
