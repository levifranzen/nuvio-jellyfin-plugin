/**
 * Jellyfin Local Provider
 * Arquivo unico — sem build, sem import/export, sem async/await.
 */

var JELLYFIN_URL = "http://192.168.1.253:8096";
var JELLYFIN_API_KEY = "07c08bed43bd4d0b90adbd02de0345e1";

function jfGet(path, params) {
    params = params || {};
    params.api_key = JELLYFIN_API_KEY;
    var query = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');

    return fetch(JELLYFIN_URL + path + '?' + query).then(function (res) {
        return res.json();
    });
}

function buildStreamUrl(itemId, mediaSourceId) {
    var url = JELLYFIN_URL + '/Videos/' + itemId + '/stream?Static=true&api_key=' + encodeURIComponent(JELLYFIN_API_KEY);
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
        AnyProviderIdEquals: 'Tmdb.' + tmdbId,
        Fields: 'ProviderIds,MediaSources'
    }).then(function (data) {
        return (data.Items && data.Items[0]) || null;
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
        return streamsFromTarget(item);
    }).catch(function () {
        return [];
    });
}

module.exports = { getStreams: getStreams };
