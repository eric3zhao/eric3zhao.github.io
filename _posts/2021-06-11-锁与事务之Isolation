好久没写了，最近稍微空闲了点把mysql的锁与事务简单的看了一遍，接下来用三篇博客记录我的学习过程。本文是第一篇，主要是对`ACID`中`Isolation`的理解，是对`隔离性`概念的解释，和具体的数据库实现无关

## Read phenomena

在讲隔离级别之前我们先要了解`Read phenomena`(读现象)。在`ANSI/ISO standard SQL 92`中提到了三种读现象。假设我们有张表数据如下：

Users
| id  | name | age |
| --- | ---- | --- |
| 1   | Joe  | 20  |
| 2   | Jill | 25  |

### Dirty reads

脏读（也叫`uncommitted dependency`），当一个事务读到了被其他事务修改但是为提交的记录

<table>
  <tr>
    <th>Transaction 1</th>
    <th>Transaction 2</th>
  </tr>
  <tr>
    <td>
      <pre>/* Query 1 */ 
SELECT age FROM users WHERE id = 1; 
/* will read 20 */</pre>
    </td>
    <td>
    </td>
  </tr>
  <tr>
    <td>
    </td>
    <td>
      <pre>/* Query 2 */ 
UPDATE users SET age = 21 WHERE id = 1; 
/* No commit here */</pre>
    </td>
  </tr>
  <tr>
    <td>
      <pre>/* Query 1 */ 
SELECT age FROM users WHERE id = 1; 
/* will read 21 */</pre>
    </td>
    <td>
    </td>
  </tr>
  <tr>
    <td>
    </td>
    <td>
      <pre>ROLLBACK; 
/* lock-based DIRTY READ */</pre>
    </td>
  </tr>
</table>

### Non-repeatable reads

不可重复读，当在一个事务中两次读取同一条记录前后两次数据值不相同

<table>
  <tr>
    <th>Transaction 1</th>
    <th>Transaction 2</th>
  </tr>
  <tr>
    <td>
      <pre>/* Query 1 */ 
SELECT * FROM users WHERE id = 1;</pre>
    </td>
    <td>
    </td>
  </tr>
  <tr>
    <td>
    </td>
    <td>
      <pre>/* Query 2 */ 
UPDATE users SET age = 21 WHERE id = 1;
COMMIT; 
/* in multiversion concurrency control, or lock-based READ COMMITTED */</pre>
    </td>
  </tr>
  <tr>
    <td>
      <pre>/* Query 1 */ 
SELECT * FROM users WHERE id = 1; COMMIT; 
/* lock-based REPEATABLE READ */</pre>
    </td>
    <td>
    </td>
  </tr>
</table>

### Phantom reads

幻读，当一个事务查询一定范围内的数据时，读取到了另外一个事务删除或者添加的该范围内的记录

<table>
  <tr>
    <th>Transaction 1</th>
    <th>Transaction 2</th>
  </tr>
  <tr>
    <td>
      <pre>/* Query 1 */
SELECT * FROM users
WHERE age BETWEEN 10 AND 30;</pre>
    </td>
    <td>
    </td>
  </tr>
  <tr>
    <td>
    </td>
    <td>
      <pre>/* Query 2 */
INSERT INTO users(id, name, age) VALUES (3, 'Bob', 27);
COMMIT;</pre>
    </td>
  </tr>
  <tr>
    <td>
      <pre>/* Query 1 */
SELECT * FROM users
WHERE age BETWEEN 10 AND 30;
COMMIT;</pre>
    </td>
    <td>
    </td>
  </tr>
</table>

## Isolation levels

在`ANSI/ISO SQL`标准中定义了4个隔离级别

### Serializable

串行化，是最高等级的事务，基于锁实现。串行化会对操作的数据添加读写锁，在事务结束时释放，当查询语句中使用了范围的`WHERE`条件就会用到`range-locks`，范围锁是用来解决幻读问题。

### Repeatable reads

可重读，会只有数据的读写锁直到事务结束，但是本级别没有`range-locks`，所以可能发生幻读。

在这个级别还需要注意`Write skew`，当两个事务同时对一张表的相同列进行写入，会导致这些列的数据混合了这两个事务的数据

![Write skew](https://i.stack.imgur.com/FhcV9.png)

### Read committed

读已提交，同样在事务结束时会释放读写锁，但是读锁在select结束以后就立即释放（所以会发生不可重复读现象），和上一个级别一样不会用到`range-locks`

读已提交，只能保证不会读到中间的，未提交的，以及不会脏读，并不能保证同一事务中前后两次相同的查询结果是一样的

### Read uncommitted

读未提交，最低级别在本级别中脏读也是允许的


|                  | Dirty reads | Non-repeatable reads | Phantoms |
| ---------------- | :---------: | :------------------: | :------: |
| Read Uncommitted |     会      |          会          |    会    |
| Read Committed   |    不会     |          会          |    会    |
| Repeatable Read  |    不会     |         不会         |    会    |
| Serializable     |    不会     |         不会         |   不会   |

