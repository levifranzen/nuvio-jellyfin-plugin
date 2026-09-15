/**
 * Jellyfin Local Provider
 * Arquivo unico — sem build, sem import/export, sem async/await.
 */

var JELLYFIN_URL = "http://192.168.1.253:8096";
var JELLYFIN_API_KEY = "2918a110412240f3b1300cf28b997cb9";

function jfGet(path, params) {
    params = params || {};
    var query = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');

    return fetch(JELLYFIN_URL + path + '?' + query, {
        headers: { 'Authorization': 'MediaBrowser Token="' + JELLYFIN_API_KEY + '"' }
    }).then(function (res) {
        return res.json();
    });
}

function buildStreamUrl(itemId, mediaSourceId) {
    var url = JELLYFIN_URL + '/Videos/' + itemId + '/stream?Static=true&ApiKey=' + encodeURIComponent(JELLYFIN_API_KEY);
    if (mediaSourceId) {
        url += '&MediaSourceId=' + encodeURIComponent(mediaSourceId);
    }
    return url;
}

function findItemByTmdbId(tmdbId, mediaType) {
    var itemType = mediaType === 'movie' ? 'Movie' : 'Series';
    return jfGet('/Items', {
        Recursive: true,
        IncludeItemTypes: itemType,
        Fields: 'ProviderIds'
    }).then(function (data) {
        var items = data.Items || [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].ProviderIds && items[i].ProviderIds.Tmdb === String(tmdbId)) {
                return items[i];
            }
        }
        return null;
    });
}

function getItemWithSources(itemId) {
  return jfGet('/Items', { ids: itemId, Fields: 'MediaSources' }).then(function (data) {
    var items = data.Items || [];
    return items[0] || null;
  });
}

function findEpisode(seriesId, season, episode) {
    return jfGet('/Shows/' + seriesId + '/Episodes', {
        Season: season,
        Fields: 'MediaSources'
    }).then(function (data) {
        var items = data.Items || [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].IndexNumber === Number(episode)) {
                return items[i];
            }
        }
        return null;
    });
}

function streamsFromTarget(target) {
    if (!target) {
        return [];
    }

    var sources = (target.MediaSources && target.MediaSources.length) ? target.MediaSources : [{ Id: undefined }];

    return sources.map(function (src, i) {
        var suffix = sources.length > 1 ? ' \u2014 Fonte ' + (i + 1) : '';
        return {
            name: 'Jellyfin',
            title: (target.Name || 'Direct Play') + suffix,
            url: buildStreamUrl(target.Id, src.Id),
            quality: src.Container ? String(src.Container).toUpperCase() : 'Original'
        };
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    return findItemByTmdbId(tmdbId, mediaType).then(function (item) {
        if (!item) {
            return [];
        }
        if (mediaType === 'tv') {
            return findEpisode(item.Id, season, episode).then(streamsFromTarget);
        }
        return getItemWithSources(item.Id).then(streamsFromTarget);
    }).catch(function () {
        return [];
    });
}

module.exports = { getStreams: getStreams };
