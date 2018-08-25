var db = openDatabase('myrssdb', '1.0', 'I can rss everthing !', 2 * 1024 * 1024);

function loadPopup() {
    //上次最后的访问页面
    if (localStorage.lastBodystr && localStorage.lastBodystr.length >= 1000) {
        document.getElementById('body').innerHTML = localStorage.lastBodystr;
    } else {
    loadRssfromWebsql();
    }
}

//点击rss列表时加载标题及条目
function sethead(rssTitle, rssUrl, rssico) {
    localStorage.headstr = '<p style="margin:0 0 0px; background-color:#FFFFFF;" data-rssUrl="' + rssUrl + '" data-title="' + rssTitle + '">' +
        '&nbsp;&nbsp;&nbsp;&nbsp;<img src ="'+ rssico +'" height="16" width="16"/>' + 
        '<a id="head" class="btn" style="font-size: 14px;" >' + rssTitle + '</a>' +
        '<a id="updateRss" class="btn" title="立刻更新当前的rss源" >刷新</a>' +
        '</p><div>';
}

function loadItemsfromWebsql(rssUrl, index, nums) {
    //console.log("loadItemsfromWebsql=====",rssUrl,index);
    db.transaction(function (tx) {
        tx.executeSql('SELECT * FROM Feeds where rssUrl = ? ORDER BY pubtimestamp DESC LIMIT ?,?', [rssUrl, index, nums], function (tx, results) {
                var len = results.rows.length;
                //console.log(len);           
                if (len) {
                    for (i = 0; i < len; i++) {
                        var itemurl = results.rows.item(i).url;
                        var title = results.rows.item(i).title;
                        //title =title.substr(0,30);
                        var isread = results.rows.item(i).isread;
                        var description = results.rows.item(i).description;
                        description = '<div class="list-group-item list-group-item-warning">'+ description + '</div>';
                        //不能截断否则将导致内部元素无结束标记,体现为下一个items变为子元素了，而且越来越小
                        description = localStorage.loadDesc?description:"";
                        if (isread == 1) {
                            localStorage.itemstr += '<a class="list-group-item list-group-item-info" href="' + itemurl + '" >' + title + '</a>' + description ;
                        } else {
                            localStorage.itemstr += '<a class="list-group-item list-group-item-info" href="' + itemurl + '" ><span class="badge pull-right" title="标记为已读">新</span>' + title + '</a>' + description;
                        }
                    }
                    localStorage.footstr = '<a id="loadmore" class="list-group-item btn list-group-item-success" style="text-align: center;" data-rssUrl="' + rssUrl + '" data-index="' + index + '">加载更多</a></div>';
                } else {
                    localStorage.footstr = '<a id="nothing" class="list-group-item btn" style="text-align: center;" title="点击返回主界面" >暂无更新！</a></div>';
                }
                //console.log(localStorage.itemstr);
                document.getElementById('item').innerHTML = localStorage.headstr + localStorage.itemstr + localStorage.footstr;
                loadDescimgmax = localStorage.loadDescimgmax?localStorage.loadDescimgmax:300;
                img_max_width_str = 'max-width: '+loadDescimgmax+'px;';//'max-width: 265px;'
                [].map.call(document.getElementsByTagName('img'), function(img){
                    img.setAttribute('style', img_max_width_str);
                  });
            },
            function (tx, error) {
                console.log('失败!', error.message)
            });
    });
}


//标记为已读
function makeItemRead(itemUrl) {
    db.transaction(function (tx) {
        tx.executeSql('SELECT isread FROM Feeds WHERE url = ?', [itemUrl], function (tx, results) {
            var isread = results.rows.item(0).isread;
            if (isread == null) {
                tx.executeSql('update Feeds set isread = 1 where url = ?', [itemUrl], null, function (tx, error) {
                    console.log('失败!', error.message)
                });
                //插入数据后更新未读条数
                tx.executeSql('UPDATE Rss SET unreadNums = ( SELECT COUNT(*) FROM Feeds WHERE isread IS NULL AND Feeds.rssUrl = Rss.rss)', []);

                changeicobar();
            }
        }, null);
    });
}
//标记为RSS已读
function makeRssRead(rssUrl) {
    db.transaction(function (tx) {
        tx.executeSql('update Feeds set isread = 1 where rssUrl = ?', [rssUrl], null, function (tx, error) {
            console.log('失败!', error.message)
        });
        tx.executeSql('update Rss set unreadNums = 0 where rss = ?', [rssUrl], null, function (tx, error) {
            console.log('失败!', error.message)
        });
        changeicobar();
    });
}
//标记目录为已读
function makeDirRead(dirstr) {
    console.log("标记目录为已读", dirstr);
    db.transaction(function (tx) {
        tx.executeSql('update Feeds set isread = 1 WHERE Feeds.rssUrl = (SELECT rss FROM Rss WHERE dir = ? and Feeds.rssUrl = Rss.rss)', [dirstr], null, function (tx, error) {
            alert('失败!', error.message)
        });
        //插入数据后更新未读条数//2018.03.19 sql语句待优化：将指定目录类下的所有rss的unreadnums设为0.而不是更新所有,2018.08.14更新
        tx.executeSql('UPDATE Rss SET unreadNums = ( SELECT COUNT(*) FROM Feeds WHERE isread IS NULL AND Feeds.rssUrl = Rss.rss)', []);
        changeicobar();
    });
}



//更换图标下的bar
function changeicobar() {
    db.transaction(function (tx) {
        tx.executeSql('SELECT COUNT(*) as nums FROM Feeds WHERE isread IS NULL', [], function (tx, results) {
                var nums = results.rows.item(0).nums;
                console.log("unreadnums", nums);
                if (nums > 0) {
                    chrome.browserAction.setBadgeBackgroundColor({
                        color: [190, 190, 190, 128]
                    }); //rgb 灰色 50%透明
                    if (nums >= 100) {
                        chrome.browserAction.setBadgeText({
                            text: '99+'
                        });
                    } else {
                        chrome.browserAction.setBadgeText({
                            text: nums.toString()
                        });
                    }
                } else {
                    chrome.browserAction.setBadgeText({
                        text: ''
                    });
                }
            },
            function (tx, error) {
                console.log('更改badge失败: ', error.message)
            });
    });

}

//页面加载时读取rss源列表
function loadRssfromWebsql() {
    db.transaction(function (tx) {
        //插入数据后更新未读条数
        tx.executeSql('UPDATE Rss SET unreadNums = ( SELECT COUNT(*) FROM Feeds WHERE isread IS NULL AND Feeds.rssUrl = Rss.rss)', []);
        //更换图标下的bar
        changeicobar();
        tx.executeSql('SELECT * FROM Rss', [],
            function (tx, results) {
                var len = results.rows.length;
                var dirstr = ""; //'武汉 房产 新闻'
                var nodirstr = "";

                document.getElementById('rss').innerHTML =
                `
                <div class="dropdown " style="background-color:#FFFFFF;">
                    &nbsp;&nbsp;&nbsp;&nbsp;
                    <img src ="./../images/icon.png" height="16" width="16"/>
                    <span style="font-size: 14px;line-height:36px">&nbsp;&nbsp;RSS订阅器</span>
                    <button class="btn btn-default dropdown-toggle " type="button" id="menu1" data-toggle="dropdown" style="float:right">+
                        <span class="caret"></span>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-right " role="menu" aria-labelledby="menu1" style="min-width:40px;">
                        <li role="presentation"><a role="menuitem" tabindex="-1" id="setrss" class="btn" title="设置"  href="./../options.html">设置</a></li>
                        <li role="presentation"><a role="menuitem" tabindex="-1" id="update" class="btn">刷新</a></li>
                        <li role="presentation"><a role="menuitem" tabindex="-1" id="addrss" class="btn" title="添加新的rss源" href="./../add_new_rss.html">添加</a></li>
                        <li role="presentation" class="divider"></li>
                        <li role="presentation"><a role="menuitem" tabindex="-1" href="#">关于</a></li>
                    </ul>
                </div>
                <div>
                `;

                for (i = 0; i < len; i++) {
                    var rss = results.rows.item(i).rss;
                    var title = results.rows.item(i).title;
                    var unreadNums = results.rows.item(i).unreadNums;
                    var dir = results.rows.item(i).dir;
                    var ico = results.rows.item(i).ico;
                    //console.log(title);
                    if(ico == null || ico == ""){
                        ico = "./../images/icon.png";
                    }


                    //rsslist
                    if (unreadNums && unreadNums > 0) {
                        var rss1 = '<div class="list-group-item btn" style="text-align: left;" data-rss="' + rss + '" data-title="' + title + '"data-ico="' + ico + '"><img src ="'+ ico +'" height="16" width="16"/>&nbsp;&nbsp;<span class="badge pull-right" title="将该RSS源标记为已读">' + unreadNums + '</span>' + title + '</div>';
                    } else {
                        var rss1 = '<div class="list-group-item btn" style="text-align: left;" data-rss="' + rss + '" data-title="' + title + '"data-ico="' + ico + '"><img src ="'+ ico +'" height="16" width="16"/>&nbsp;&nbsp;' + title + '</div>';
                    }

                    if (dir) {
                        //指定了目录则先判断目录是否已添加
                        if (dirstr.indexOf(dir) >= 0) {
                            //已添加则直接加入该目录
                            var obj = document.getElementById(dir);
                            obj.innerHTML += rss1;
                            //更新目录bar
                            var a = document.getElementById(dir + 'nums');
                            if (a) {
                                a.innerHTML = Number(a.innerHTML) + unreadNums;
                            } 
                            else if( unreadNums > 0 ){
                                document.getElementById(dir + 'head').innerHTML += ('<span id="' + dir + 'nums" class="badge pull-right btn" title="将目录标记为已读">' + unreadNums + '</span>');
                            }

                        } else {
                            dirstr += dir;
                            //未添加则先加目录在添加
                            if (unreadNums && unreadNums > 0) {
                                document.getElementById('rss').innerHTML += '<div id="' + dir + 'head" class="list-group-item" style="text-align: left;background-color:#EEEEEE;" data-toggle="collapse"  href="#' + dir + '"><img src="/images/folder-icon.png" width="16" height="16"/>&nbsp;&nbsp;' + dir + '<span id="' + dir + 'nums" class="badge pull-right btn" title="将目录标记为已读">' + unreadNums + '</span></div>';
                            } else {
                                document.getElementById('rss').innerHTML += '<div id="' + dir + 'head" class="list-group-item" style="text-align: left;background-color:#EEEEEE;" data-toggle="collapse"  href="#' + dir + '"><img src="/images/folder-icon.png" width="16" height="16"/>&nbsp;&nbsp;' + dir + '</div>';
                            }

                            var obj = document.createElement('div');
                            obj.id = dir;
                            obj.classList = "panel-collapse collapse in;";
                            //console.log(rss1);
                            obj.innerHTML = rss1;//TODO: 报错无影响，原因未知 2018.08.11
                            document.getElementById('rss').innerHTML += obj.outerHTML;
                        }
                    } else {
                        //没指定目录则移到最后再添加
                        nodirstr += rss1;
                    }
                }
                document.getElementById('rss').innerHTML += (nodirstr + "</div>");
                localStorage.rssstr = document.getElementById('rss').innerHTML;
            }, null);
        
    });
}


//储存items到websql
function items2websql(items) {
    db.transaction(function (tx) {
        for (i = 0; i < items.length; i++) {
            tx.executeSql('INSERT OR IGNORE INTO Feeds (url,title,pubtimestamp,rssUrl,description,category,content,guid) VALUES (?,?,?,?,?,?,?,?)', items[i],
                null,
                function (tx, error) {
                    console.log('添加数据失败: ' + error.message)
                });
        }
    });
}

/*从<![CDATA[%s]]>中取出%s*/
function removeCDATA(fstr) {
    return fstr.replace("<![CDATA[", "").replace("]]>", "").replace('<p><sub><i>-- Delivered by <a href="http://feed43.com/">Feed43</a> service</i></sub></p>', "")
}

//必须加https://，否则默认前缀为chrome-extension://dhjefkpchmfdghfipcdmaodhigmfbpef
function addhttphead(url) {
    if (url.substr(0, 8) != 'https://' && url.substr(0, 7) != 'http://') {
        if (url.substr(0, 2) == '//') {
            return 'https:' + url;
        } else {
            return 'https://' + url;
        }
    } else {
        return url;
    }
}

function parseAtomFeedItem(xmlstr,rssurl) {
    console.log(" parseAtomFeedItem :",rssurl);

    //var rssurl = xmlstr.getElementsByTagName('id')[0].innerHTML;
    //这个id不一定是rssUrl,只是唯一标识，此处导致部分atom更新失败,已改为参数传入

    var items = [];
    if (xmlstr.getElementsByTagName('feed')) {
        var list = xmlstr.getElementsByTagName('entry');

        for (i = 0; i < list.length; i++) {

            var link = list[i].getElementsByTagName('link')[0].getAttribute('href');
            linkfix = addhttphead(link);

            var title = list[i].getElementsByTagName('title')[0].innerHTML;
            var titlefix = removeCDATA(title);

            var published_node = list[i].getElementsByTagName('published');
            var published = published_node.length?published_node[0].innerHTML:null; //若不存在guid，则guid_node也会有对象，但长度为0
            var pubtimestamp = Math.round(new Date(published).getTime() / 1000);

            var updated = list[i].getElementsByTagName('updated')[0].innerHTML;
            var updatedtimestamp = Math.round(new Date(updated).getTime() / 1000);

            /* 可选项解析 */
            var desc = list[i].getElementsByTagName('summary');
            var category = desc.length?list[i].getElementsByTagName('summary')[0].innerHTML:"";
            var descfix = removeCDATA(desc);

            var guid_node = list[i].getElementsByTagName('guid');
            var guid = guid_node.length?guid_node[0].innerHTML:'';//若不存在guid，则guid_node也会有对象，但长度为0

            var category = list[i].getElementsByTagName('category');
            var category = category.length?category[0].getAttribute('term'):"";//list类型,待优化
            var categoryfix = removeCDATA(category);

            var content = list[i].getElementsByTagName('content');
            var content = content.length?content[0].innerHTML:"";
            var contentfix = removeCDATA(content);


            //console.log("item",i,titlefix);
            //executeSql第一条执行完毕之前for循环已经结束了，故只插入了一条记录，需先保存起来在一次插入
            items.push([linkfix, titlefix, updatedtimestamp, rssurl, descfix, categoryfix, contentfix, guid]);
        }
    }
    console.log(items);
    return items;
}


//解析items
function parseXmlstr(rssxml, rssurl) {
    //console.log(rssxml); //err console.log(rssxml.innerHTML);
    if (rssxml) {
        var items = [];
        var type = rssxml.getElementsByTagName('rss');
        if (type.length >= 1) {
            var list = rssxml.getElementsByTagName('item');

            for (i = 0; i < list.length; i++) {

                var link = list[i].getElementsByTagName('link')[0].innerHTML;
                if(rssurl == 'http://www.feed43.com/4677052036764060.xml'){
                    linkfix = addhttphead(link).split("#")[0];//光谷社区等一个帖子多个reply，只保留一个;//只保留#号前面的部分
                }else{
                    linkfix = addhttphead(link);//bilibili等番剧分集，要保留多个(不作处理);
                }

                var title = list[i].getElementsByTagName('title')[0].innerHTML;
                var titlefix = removeCDATA(title);

                var desc = list[i].getElementsByTagName('description')[0].innerHTML;
                var descfix = removeCDATA(desc);

                var guid_node = list[i].getElementsByTagName('guid');
                var guid = guid_node.length?guid_node[0].innerHTML:'';


                /* 根据pubtimestamp加载最新的items，该项若没有则取当前值*/
                var pub = list[i].getElementsByTagName('pubDate');
                var pubdate = pub.length?pub[0].innerHTML:null; //若不存在guid，则guid_node也会有对象，但长度为0
                var pubtimestamp = pubdate?Math.round(new Date(pubdate).getTime() / 1000):Math.round(new Date().getTime() / 1000);

                /* 可选项解析 */ 
                var category = list[i].getElementsByTagName('category');
                var category = category.length?category[0].innerHTML:"";
                var categoryfix = removeCDATA(category);

                var content = list[i].getElementsByTagName('content:encoded');
                var content = content.length?content[0].innerHTML:"";
                var contentfix = removeCDATA(content);

                //console.log("item",i,titlefix);
                //executeSql第一条执行完毕之前for循环已经结束了，故只插入了一条记录，需先保存起来在一次插入
                items.push([linkfix, titlefix, pubtimestamp, rssurl, descfix, categoryfix, contentfix, guid]);
            }
        } else { // if(rssxml.getElementsByTagName('feed').length >=1)
            items = parseAtomFeedItem(rssxml,rssurl);
            //console.log(items);
        }

        items2websql(items);
        console.log(rssurl, "更新成功！");

    } else {
        console.log(rssurl, "更新失败!");
    }
}

//请求RSS源
function httpRequest(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            callback(xhr.responseXML, url); //此处返回xml对象
        }
    }
    xhr.send();
}

//测试httpRequest
var xml;

function testcallback(rssxml, rssurl) {
    console.log("testcallback", rssxml);
    xml = rssxml;
}
//httpRequest("http://dig.chouti.com/feed.xml",testcallback);

//定期 读取rss列表并依次执行请求
function rss_request() {
    console.log("开始请求rss源数据...")
    db.transaction(function (tx) {
        tx.executeSql('SELECT rss FROM Rss', [], function (tx, results) {
                var len = results.rows.length;
                //console.log(len);
                for (i = 0; i < len; i++) {
                    var rssUrl = results.rows.item(i).rss;
                    var title = results.rows.item(i).title;
                    console.log("请求",title,rssUrl);
                    httpRequest(rssUrl, parseXmlstr);
                }
            },
            function (tx, error) {
                console.log('查询数据失败: ', error.message)
            });
        //插入数据后更新未读条数
        tx.executeSql('UPDATE Rss SET unreadNums = ( SELECT COUNT(*) FROM Feeds WHERE isread IS NULL AND Feeds.rssUrl = Rss.rss)', []);
        //更换图标下的bar
        changeicobar();
        //loadRssfromWebsql();
    });
    //console.log("请求rss源数据完毕！5mim后再次执行！")
}


function init() {
    db.transaction(function (tx) {

        //新建表
        tx.executeSql('CREATE TABLE IF NOT EXISTS Rss (id,rss unique, title,unreadNums,dir,ico,pubtimestamp)');
        tx.executeSql('CREATE TABLE IF NOT EXISTS Feeds (id,rssid,url unique, title, pubtimestamp,isread,rssUrl,description,category,content,guid)');

        //插入一个rss源(若开启，则每次都尝试添加，即删不了了)
        //tx.executeSql('INSERT OR IGNORE INTO Rss (rss,title,ico) VALUES (?, ?, ?)', ["http://www.ndrc.gov.cn/xwzx/xwfb/rss.xml", "发改委新闻发布","http://www.ndrc.gov.cn/images/guobiao01.png"]);
        //tx.executeSql('INSERT OR IGNORE INTO Rss (rss,title,dir,ico) VALUES (?, ?, ?, ?)', ["https://feed43.com/2770086871034514.xml", "抽屉24h最热榜","新闻","https://dig.chouti.com/images/chouti.ico"]);
        //tx.executeSql('INSERT OR IGNORE INTO Rss (rss,title,dir,ico) VALUES (?, ?, ?, ?)', ["https://rsshub.app/bilibili/bangumi/24588", "工作细胞","bilibili","https://i0.hdslb.com/bfs/bangumi/80edca06302d6e36f6f4948dea0fd09b940c5a91.png@144w_144h.webp"]);


    });
}