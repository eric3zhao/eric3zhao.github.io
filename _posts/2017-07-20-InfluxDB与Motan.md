最近一个项目需要用到[InfluxDB](https://www.influxdata.com)，根据官网的说明我们使用[Influxdb-java](https://github.com/influxdata/influxdb-java)作为客户端的lib，同时结合[Motan](https://github.com/weibocom/motan)提供RPC服务。

## 创建一个DAO（伪）
基于Influxdb实现一个伪DAO类

```java
public class BuguInfluxDB {
    private static final Logger log = LoggerFactory.getLogger(BuguInfluxDB.class);

    private InfluxDB db;
    private ScheduledExecutorService pingSchedule = Executors.newSingleThreadScheduledExecutor();
    private String dataBase;

    public BuguInfluxDB(String url, String userName, String password, String dataBase) {
        db = InfluxDBFactory.connect(url, userName, password);
        db.enableBatch(2000, 100, TimeUnit.MILLISECONDS, Executors.defaultThreadFactory(), (failedPoints, throwable) -> { /* custom error handling here */ });
        db.setDatabase(dataBase);
        this.dataBase = dataBase;
        pingSchedule.scheduleAtFixedRate(() -> {
            try {
                Pong pong = db.ping();
                log.info("ping influxdb:{}", pong);
            } catch (Exception e) {
                log.error("failed to ping influxdb", e);
            }
        }, 10, 10, TimeUnit.SECONDS);
    }

    /**
     * 插入单个point
     *
     * @param measurement
     * @param tags
     * @param fields
     * @param time
     */
    public void insertSinglePoint(String measurement, Map tags, Map fields, Long time) {
        Point point = Point.measurement(measurement).time(time, TimeUnit.MILLISECONDS).tag(tags).fields(fields).build();
        db.write(point);
    }

    public List<InfluxResult> getSingleQuery(String sql) throws Exception {
        return getSingleQuery(sql, Boolean.TRUE);
    }

    public List<InfluxResult> getSingleQuery(String sql, boolean postQuery) throws Exception {
        Query query = new Query(sql, dataBase, postQuery);
        QueryResult queryResult = db.query(query, TimeUnit.MILLISECONDS);
        if (queryResult.hasError()) {
            throw new Exception(queryResult.getError());
        }
        QueryResult.Result result = queryResult.getResults().get(0);
        if (result.hasError()) {
            throw new Exception(result.getError());
        }
        List<InfluxResult> resultArray = new ArrayList<>();
        for (QueryResult.Series series : result.getSeries()) {
            List<JSONObject> list = series2List(series);
            InfluxResult influxResult = new InfluxResult();
            influxResult.setMeasurement(series.getName());
            influxResult.setSeries(list);
            resultArray.add(influxResult);
        }
        return resultArray;
    }

    private List series2List(QueryResult.Series series) {
        List<String> columns = series.getColumns();
        List<List<Object>> values = series.getValues();
        List<JSONObject> results = values.stream().parallel().map(point -> {
            JSONObject jsonObject = new JSONObject();
            for (int idx = 0; idx < columns.size(); idx++) {
                jsonObject.put(columns.get(idx), point.get(idx));
            }
            return jsonObject;
        }).collect(Collectors.toList());
        return results;
    }

    private JSONArray series2JSONArray(QueryResult.Series series) {
        List<String> columns = series.getColumns();
        List<List<Object>> values = series.getValues();
        JSONArray jsonArray = values.stream().parallel().map(point -> {
            JSONObject jsonObject = new JSONObject();
            for (int idx = 0; idx < columns.size(); idx++) {
                jsonObject.put(columns.get(idx), point.get(idx));
            }
            return jsonObject;
        }).collect(JSONArray::new, List::add, List::addAll);
        return jsonArray;
    }

    public void destory() {
        db.close();
        System.out.println("关闭db！！！！");
    }
}
```

### `List series2List(QueryResult.Series series)`的作用。

使用Influxdb的语句查询得到的结果如下所示，但是在使用的时候key-value的
形式比column与values分离的结果更容易处理

```
{
    "name": "cpu",
    "columns": [
        "time",
        "host",
        "region",
        "value"
    ],
    "values": [
        [
            "2015-06-11T20:46:02Z",
            "server01",
            "us-west",
            0.64
        ],
        [
            "2017-05-15T09:16:49.0059282Z",
            "serverA",
            "cn",
            0.66
        ]
    ]
}
```

经过`series2List`方法转化成`List<JSONObject>`

```
[
    {
        "host": "server01",
        "time": "2015-06-11T20:46:02Z",
        "region": "us-west",
        "value": 0.64
    },
    {
        "host": "serverA",
        "time": "2017-05-15T09:16:49.0059282Z",
        "region": "cn",
        "value": 0.66
    }
]
```
**补充：当时在实现的时候InfluxDB-java更新到2.5版本。最新的版本已经支持将查询结果转为POJO（QueryResult mapper to POJO (version 2.7+ required)）**