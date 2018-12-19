(function($, PM) {
  if (location.href.indexOf('wall') > 0) return;

  PM.tilt.init();

  PM.bgm = new PM.BGM($('#bgm-audio'), {
    src: '/audios/music.mp3',
    autoplay: false
  });


  var slick = $('.gallery').slick({
    arrows: false,
    infinite: true,
    speed: 500,
    fade: true,
    cssEase: 'linear',
    autoplay: true,
    autoplaySpeed: 4000,
    lazyLoad: 'ondemand'
  }).on('afterChange', function(e, slick, index) {
    var $img = $(slick.$slides[index]).find('img').addClass('disable-tilt');
    PM.tilt.pause();
    PM.tilt.setTilt($img.data('tiltObj').reset()).update();
    PM.tilt.play();
    $img.removeClass('disable-tilt');
  }).slick('getSlick');

  if (slick.$slides) {
    slick.$slides.find('img').each(function() {
      $(this).data('tiltObj', new PM.Tilt($(this)));
    });

    // update first when init
    PM.tilt.setTilt($(slick.$slides[0]).find('img').data('tiltObj')).update();
    $(slick.$slides[0]).find('img').removeClass('disable-tilt');
  }

  $('#btn-back').on('tap', function(e) {
    $('#pnl-fullpage .slide').removeClass('slideup');
    e.preventDefault();
  });

  $('#btn-map').on('tap', function(e) {
    var $btn = $(this);
    if ($btn.hasClass('weui_btn_disabled')) {
      return;
    }
    $btn.addClass('weui_btn_disabled');
      $('#pnl-fullpage .slide').addClass('slideup');

    PM.map.open().always(function() {
      $btn.removeClass('weui_btn_disabled');
    });
    e.preventDefault();
  });

  $('#btn-wish').on('tap', function(e) {
    $('#btn-group').removeClass('dock-show').addClass('dock-hide');
    $('#wish-box').removeClass('dock-hide').addClass('dock-show');
    e.preventDefault();
  });

  $('#btn-close-wish').on('tap', function(e) {
    $('#ipt-wish').blur();
    $('#wish-box').removeClass('dock-show').addClass('dock-hide');
    $('#btn-group').removeClass('dock-hide').addClass('dock-show');
    e.preventDefault();
  });

  var getPlaceholder = (function() {
    var last = 0;

    return function() {
      var ps = [
        '为我们送上祝福吧',
        '新郎帅不帅',
        '新娘美不美',
        '来，在这输入，我带你飞',
        '听说你知道新郎的秘密',
        '听说你知道新娘的秘密',
        '来不及解释了，快上车',
        '颜值高的和祝福多的都有机会中奖',
        '据说10月5号弹幕会下红包雨',
        '你怎么才来啊',
        '终于等到你，还好我没放弃',
        '让祝福飞一会儿',
        '你知道新郎和新娘是怎么认识的吗',
        '执子之手，与子一起抢红包',
        '天将降红包于斯人也',
        '百年好合，红包大额'
      ];
      var curr = last;

      while (true) {
        curr = Math.floor(Math.random()*ps.length);
        if (curr != last) {
          break;
        }
      }

      last = curr;
      return ps[curr];
    };
  }());

  $('#ipt-wish').fittextarearows(1, 5).on('focus', function() {
    PM.tilt.disable();
  }).on('blur', function() {
    PM.tilt.enable();
    $(this).attr('placeholder', getPlaceholder());
  }).on('touchmove touchstart', function (e) {
      e.stopPropagation();
  }).attr('placeholder', getPlaceholder());



  $('.fullpage').on('touchmove', function(e) {
    e.preventDefault();
  });

  if ($('#wish-board').size() > 0) {
    PM.poller.poll();
    PM.board.init($('#wish-board'));
  }
}(jQuery, PM));
