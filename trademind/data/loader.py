"""
TradeMind Lite（轻量版）- 数据加载器

本模块包含股票数据加载相关的功能。
"""

import os
import json
import time
import logging
import yfinance as yf
import pandas as pd
import numpy as np
from typing import Dict, Optional, List, Tuple, Any, Union
import re
import akshare as ak
import tushare as ts
from datetime import datetime, timedelta
import toml
from pathlib import Path

# 设置日志
logger = logging.getLogger(__name__)

# 读取配置文件
def load_config():
    try:
        config_path = Path(__file__).parent.parent.parent / 'config.toml'
        if config_path.exists():
            config = toml.load(str(config_path))
            return config.get('tokens', {}).get('tushare_token', '')
        return ''
    except Exception as e:
        logger.error(f"读取配置文件失败: {str(e)}")
        return ''

# Tushare Token配置
TUSHARE_TOKEN = os.getenv('TUSHARE_TOKEN', '') or load_config()
if TUSHARE_TOKEN:
    ts.set_token(TUSHARE_TOKEN)
    pro = ts.pro_api()
else:
    logger.warning("未设置Tushare Token，部分A股数据获取功能可能受限")

# 股票分类规则
STOCK_CATEGORIES = {
    # A股主板
    "A股主板": [
        r"^60[0-3]\d{3}\.SH$",  # 上海主板
        r"^000\d{3}\.SZ$",      # 深圳主板
    ],
    
    # A股创业板
    "A股创业板": [
        r"^30[0-1]\d{3}\.SZ$",  # 创业板
    ],
    
    # A股科创板
    "A股科创板": [
        r"^688\d{3}\.SH$",      # 科创板
    ],
    
    # A股中小板
    "A股中小板": [
        r"^002\d{3}\.SZ$",      # 中小板
    ],
    
    # A股北交所
    "A股北交所": [
        r"^8[3-9]\d{4}\.BJ$",   # 北交所
    ],

    # A股行业分类 - 金融
    "A股金融": [
        r"^600[0-9]{3}\.SH$",   # 银行、保险、券商等
        r"^601[0-9]{3}\.SH$",
        r"^000[0-9]{3}\.SZ$"
    ],
    
    # A股行业分类 - 科技
    "A股科技": [
        r"^688[0-9]{3}\.SH$",   # 科创板科技股
        r"^300[0-9]{3}\.SZ$",   # 创业板科技股
        r"^603[0-9]{3}\.SH$"    # 上海主板科技股
    ],
    
    # A股行业分类 - 消费
    "A股消费": [
        r"^60[0-9]{4}\.SH$",    # 食品饮料、家电、商贸等
        r"^000[0-9]{3}\.SZ$",
        r"^002[0-9]{3}\.SZ$"
    ],
    
    # A股行业分类 - 医药
    "A股医药": [
        r"^60[0-9]{4}\.SH$",    # 医药、生物、医疗器械等
        r"^300[0-9]{3}\.SZ$",
        r"^688[0-9]{3}\.SH$"
    ],
    
    # 指数与ETF
    "指数与ETF": [
        # 指数
        r"^\^",  # 所有以^开头的代码（Yahoo Finance格式的指数）
        r"SPY$", r"VOO$", r"IVV$",  # 标普500 ETF
        r"QQQ[A-Z]?$",  # 纳指ETF
        r"^XL[PKYFVIEU]$",  # SPDR行业ETF
        r"^KXI$", r"^PBJ$", r"^DBC$", r"^GLD$", r"^UYG$",  # 其他常见ETF
        r"^FENY$", r"^FTEC$", r"^IBIT$", r"^ONEQ$", r"^XAR$",  # 其他ETF
        r"^TLT$", r"^SHY$",  # 债券ETF
    ],
    
    # 科技巨头
    "科技巨头": [
        r"^AAPL$", r"^MSFT$", r"^NVDA$", r"^GOOG$", r"^GOOGL$", 
        r"^AMZN$", r"^META$", r"^TSLA$", r"^CRM$", r"^ADBE$", 
        r"^ORCL$", r"^IBM$"
    ],
    
    # 半导体与硬件
    "半导体与硬件": [
        r"^TSM$", r"^ASML$", r"^AVGO$", r"^QCOM$", r"^AMD$", 
        r"^INTC$", r"^AMAT$", r"^MU$", r"^ARM$", r"^SNPS$", 
        r"^DELL$", r"^WDC$", r"^SONY$", r"^HPQ$", r"^LRCX$",
        r"^KLAC$", r"^TXN$", r"^NVDA$"  # NVDA也可能在科技巨头分类中
    ],
    
    # 互联网与软件
    "互联网与软件": [
        r"^PANW$", r"^NET$", r"^SPOT$", r"^BILI$", r"^NFLX$", 
        r"^COIN$", r"^CSCO$", r"^PLTR$", r"^EBAY$", r"^NNOX$", 
        r"^TEM$", r"^ZM$", r"^DASH$", r"^UBER$", r"^LYFT$",
        r"^SHOP$", r"^SNAP$", r"^PINS$", r"^TWTR$", r"^RBLX$"
    ],
    
    # 金融与支付
    "金融与支付": [
        r"^GS$", r"^MS$", r"^JPM$", r"^BLK$", r"^C$", 
        r"^BAC$", r"^WFC$", r"^V$", r"^AXP$", r"^PYPL$", 
        r"^SCHW$", r"^COF$", r"^UBS$", r"^HSBC$", r"^KKR$", 
        r"^SMFG$", r"^MCO$", r"^MET$", r"^MA$", r"^BX$"
    ],
    
    # 中概股
    "中概股": [
        r"^PDD$", r"^BABA$", r"^JD$", r"^NIO$", r"^LI$", 
        r"^TME$", r"^ZH$", r"^BIDU$", r"^TCOM$", r"^NTES$",
        r"^BILI$", r"^IQ$", r"^XPEV$"
    ],
    
    # 能源与工业
    "能源与工业": [
        r"^XOM$", r"^CVX$", r"^OXY$", r"^CAT$", r"^BA$", 
        r"^LMT$", r"^NOC$", r"^RTX$", r"^GE$", r"^MMM$", 
        r"^GD$", r"^F$", r"^BAESY$", r"^HII$", r"^LHX$",
        r"^GM$", r"^HAL$", r"^SLB$", r"^COP$", r"^EOG$"
    ],
    
    # 医疗健康
    "医疗健康": [
        r"^JNJ$", r"^LLY$", r"^PFE$", r"^MRK$", r"^ABT$", 
        r"^GILD$", r"^NVO$", r"^MDT$", r"^AZN$", r"^GSK$",
        r"^MRNA$", r"^BIIB$", r"^REGN$", r"^VRTX$", r"^AMGN$"
    ],
    
    # 消费与服务
    "消费与服务": [
        r"^WMT$", r"^COST$", r"^BBY$", r"^MCD$", r"^PG$", 
        r"^UL$", r"^NKE$", r"^UAA$", r"^ADDYY$", r"^KO$", 
        r"^DIS$", r"^SBUX$", r"^KHC$", r"^KMB$", r"^TGT$",
        r"^HD$", r"^LOW$", r"^YUM$", r"^DKNG$", r"^ABNB$"
    ],
    
    # 交通与物流
    "交通与物流": [
        r"^DAL$", r"^ALK$", r"^UAL$", r"^AAL$", r"^DLAKY$", 
        r"^BKNG$", r"^MAR$", r"^ABNB$", r"^UBER$", r"^FDX$", 
        r"^UPS$", r"^JBHT$", r"^CHRW$", r"^EXPD$", r"^ODFL$"
    ],
    
    # 电信与通讯
    "电信与通讯": [
        r"^TMUS$", r"^T$", r"^KDDIY$", r"^VZ$", r"^LUMN$",
        r"^CMCSA$", r"^CHTR$", r"^DISH$", r"^ATUS$", r"^CCOI$"
    ]
}

def get_us_stock_data(symbol: str, period: str = "1y", interval: str = "1d", max_retries: int = 3) -> pd.DataFrame:
    """
    获取美股股票历史数据，带有重试机制
    
    参数:
        symbol: 股票代码
        period: 数据周期，如1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
        interval: 数据间隔，如1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
        max_retries: 最大重试次数
        
    返回:
        pd.DataFrame: 股票历史数据
    """
    for attempt in range(max_retries):
        try:
            stock = yf.Ticker(symbol)
            hist = stock.history(period=period, interval=interval)
            
            if hist.empty:
                logger.warning(f"获取 {symbol} 的数据为空，尝试重试 ({attempt + 1}/{max_retries})")
                if attempt < max_retries - 1:
                    time.sleep(5 * (attempt + 1))  # 递增等待时间
                    continue
            return hist
            
        except yf.exceptions.YFRateLimitError:
            if attempt < max_retries - 1:
                wait_time = 5 * (attempt + 1)  # 递增等待时间
                logger.warning(f"请求频率限制，等待 {wait_time} 秒后重试 ({attempt + 1}/{max_retries})")
                time.sleep(wait_time)
            else:
                logger.error(f"获取 {symbol} 的数据失败：达到最大重试次数")
                raise
                
        except Exception as e:
            logger.error(f"获取 {symbol} 的数据时出错: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(3)  # 基本等待时间
                continue
            raise
            
    return pd.DataFrame()  # 如果所有重试都失败，返回空DataFrame

def get_stock_data(symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    """
    获取股票历史数据，根据股票代码自动选择数据源
    
    参数:
        symbol: 股票代码
        period: 数据周期，如1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
        interval: 数据间隔，如1d, 1wk, 1mo
        
    返回:
        pd.DataFrame: 股票历史数据
    """
    try:
        # 判断股票市场类型
        is_cn_stock = False
        
        # 1. 检查是否带有.SH、.SZ、.BJ后缀
        if any(suffix in symbol.upper() for suffix in ['.SH', '.SZ', '.BJ']):
            is_cn_stock = True
        # 2. 检查是否带有SH、SZ、BJ前缀
        elif any(symbol.upper().startswith(prefix) for prefix in ['SH', 'SZ', 'BJ']):
            is_cn_stock = True
        # 3. 检查纯数字代码是否符合A股规则
        elif symbol.isdigit():
            if (
                # 上海证券交易所
                symbol.startswith(('600', '601', '603', '605', '688')) or
                # 深圳证券交易所
                symbol.startswith(('000', '001', '002', '003', '300', '301')) or
                # 北京证券交易所
                symbol.startswith(('430', '83', '87', '88', '89'))
            ):
                is_cn_stock = True
        
        # 根据市场类型选择数据源
        if is_cn_stock:
            return get_cn_stock_data(symbol, period, interval)
        else:
            return get_us_stock_data(symbol, period, interval)
            
    except Exception as e:
        logger.error(f"获取股票 {symbol} 的历史数据时出错: {str(e)}")
        return pd.DataFrame()

def get_stock_info(symbol: str) -> Dict:
    """
    获取股票信息
    
    参数:
        symbol: 股票代码
        
    返回:
        Dict: 股票信息
    """
    try:
        stock = yf.Ticker(symbol)
        info = stock.info
        return info
    except Exception as e:
        logger.error(f"获取 {symbol} 的信息时出错: {str(e)}")
        return {}

def get_cn_stock_data(symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    """
    获取A股股票历史数据，优先使用akshare，如果失败则尝试使用tushare
    
    参数:
        symbol: 股票代码（支持格式：000001.SZ、SZ000001、000001）
        period: 数据周期，如1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
        interval: 数据间隔，如1d, 1wk, 1mo
        
    返回:
        pd.DataFrame: 股票历史数据
    """
    try:
        # 标准化股票代码格式
        pure_symbol = ""
        market = ""
        
        # 处理带后缀的格式（如：000001.SZ）
        if "." in symbol:
            parts = symbol.split(".")
            pure_symbol = parts[0]
            market = parts[1]
        # 处理带前缀的格式（如：SZ000001）
        elif symbol.upper().startswith(("SH", "SZ", "BJ")):
            market = symbol[:2].upper()
            pure_symbol = symbol[2:]
        # 处理纯数字格式（如：000001）
        elif symbol.isdigit():
            pure_symbol = symbol
            # 根据股票代码规则判断市场
            if symbol.startswith(("600", "601", "603", "605", "688")):
                market = "SH"
            elif symbol.startswith(("000", "001", "002", "003", "300", "301")):
                market = "SZ"
            elif symbol.startswith(("430", "83", "87", "88", "89")):
                market = "BJ"
            else:
                raise ValueError(f"无法识别的股票代码格式: {symbol}")
        else:
            raise ValueError(f"无法识别的股票代码格式: {symbol}")
            
        # 解析时间周期
        end_date = datetime.now()
        if period == "1d":
            start_date = end_date - timedelta(days=1)
        elif period == "5d":
            start_date = end_date - timedelta(days=5)
        elif period == "1mo":
            start_date = end_date - timedelta(days=30)
        elif period == "3mo":
            start_date = end_date - timedelta(days=90)
        elif period == "6mo":
            start_date = end_date - timedelta(days=180)
        elif period == "1y":
            start_date = end_date - timedelta(days=365)
        elif period == "2y":
            start_date = end_date - timedelta(days=365*2)
        elif period == "5y":
            start_date = end_date - timedelta(days=365*5)
        else:
            start_date = end_date - timedelta(days=365)  # 默认一年
            
        start_date_str = start_date.strftime('%Y%m%d')
        end_date_str = end_date.strftime('%Y%m%d')
        
        # 尝试使用akshare获取数据
        try:
            df = ak.stock_zh_a_hist(symbol=pure_symbol, period="daily", 
                                  start_date=start_date_str, end_date=end_date_str,
                                  adjust="qfq")
            
            # 重命名列以匹配yfinance格式
            df = df.rename(columns={
                '日期': 'Date',
                '开盘': 'Open',
                '收盘': 'Close',
                '最高': 'High',
                '最低': 'Low',
                '成交量': 'Volume',
                '成交额': 'Amount',
                '振幅': 'Amplitude',
                '涨跌幅': 'Change',
                '涨跌额': 'ChangeAmount',
                '换手率': 'TurnoverRate'
            })
            
            # 设置日期索引
            df['Date'] = pd.to_datetime(df['Date'])
            df.set_index('Date', inplace=True)
            
            return df
            
        except Exception as e:
            logger.warning(f"使用akshare获取{symbol}数据失败，尝试使用tushare: {str(e)}")
            
            # 如果akshare失败且有tushare token，尝试使用tushare
            if TUSHARE_TOKEN:
                # 确保代码格式正确（000001.SZ -> 000001.XSHE，600000.SH -> 600000.XSHG）
                market = symbol.split('.')[-1]
                code = symbol.split('.')[0]
                if market == 'SZ':
                    ts_symbol = f"{code}.XSHE"
                else:
                    ts_symbol = f"{code}.XSHG"
                
                df = ts.pro_bar(ts_code=symbol, adj='qfq',
                              start_date=start_date_str,
                              end_date=end_date_str)
                
                if df is not None and not df.empty:
                    # 重命名列以匹配yfinance格式
                    df = df.rename(columns={
                        'trade_date': 'Date',
                        'open': 'Open',
                        'high': 'High',
                        'low': 'Low',
                        'close': 'Close',
                        'vol': 'Volume',
                        'amount': 'Amount'
                    })
                    
                    # 设置日期索引
                    df['Date'] = pd.to_datetime(df['Date'])
                    df.set_index('Date', inplace=True)
                    
                    return df
            
            raise Exception(f"无法获取{symbol}的数据：akshare和tushare都失败了")
            
    except Exception as e:
        logger.error(f"获取A股{symbol}的历史数据时出错: {str(e)}")
        print(f"❌ 获取A股{symbol}的历史数据失败: {str(e)}")
        return pd.DataFrame()

def get_cn_stock_info(symbol: str) -> Dict:
    """
    获取A股股票信息
    
    参数:
        symbol: 股票代码（格式：000001.SZ或600000.SH）
        
    返回:
        Dict: 股票信息
    """
    try:
        # 移除.SZ或.SH后缀
        pure_symbol = symbol.split('.')[0]
        
        # 使用akshare获取股票信息
        try:
            # 获取实时行情
            real_time_info = ak.stock_zh_a_spot_em()
            stock_info = real_time_info[real_time_info['代码'] == pure_symbol].to_dict('records')[0]
            
            # 获取公司基本信息
            company_info = ak.stock_individual_info_em(symbol=pure_symbol)
            
            # 合并信息
            info = {
                'symbol': symbol,
                'name': stock_info.get('名称', ''),
                'industry': stock_info.get('所处行业', ''),
                'market_cap': stock_info.get('总市值', 0),
                'pe_ratio': stock_info.get('市盈率', 0),
                'pb_ratio': stock_info.get('市净率', 0),
                'float_shares': stock_info.get('流通股本', 0),
                'total_shares': stock_info.get('总股本', 0),
                'price': stock_info.get('最新价', 0),
                'change': stock_info.get('涨跌幅', 0),
                'volume': stock_info.get('成交量', 0),
                'amount': stock_info.get('成交额', 0),
                'turnover_rate': stock_info.get('换手率', 0),
                'company_profile': company_info.to_dict() if not company_info.empty else {}
            }
            
            return info
            
        except Exception as e:
            logger.warning(f"使用akshare获取{symbol}信息失败，尝试使用tushare: {str(e)}")
            
            # 如果akshare失败且有tushare token，尝试使用tushare
            if TUSHARE_TOKEN:
                # 获取基本信息
                basic_info = pro.stock_basic(ts_code=symbol, fields='symbol,name,area,industry,market,list_date')
                
                if not basic_info.empty:
                    # 获取实时行情
                    daily_basic = pro.daily_basic(ts_code=symbol, fields='ts_code,trade_date,pe,pb,total_mv,circ_mv,turnover_rate')
                    
                    info = {
                        'symbol': symbol,
                        'name': basic_info['name'].values[0],
                        'industry': basic_info['industry'].values[0],
                        'area': basic_info['area'].values[0],
                        'market': basic_info['market'].values[0],
                        'list_date': basic_info['list_date'].values[0]
                    }
                    
                    if not daily_basic.empty:
                        info.update({
                            'pe_ratio': daily_basic['pe'].values[0],
                            'pb_ratio': daily_basic['pb'].values[0],
                            'market_cap': daily_basic['total_mv'].values[0],
                            'float_market_cap': daily_basic['circ_mv'].values[0],
                            'turnover_rate': daily_basic['turnover_rate'].values[0]
                        })
                    
                    return info
            
            raise Exception(f"无法获取{symbol}的信息：akshare和tushare都失败了")
            
    except Exception as e:
        logger.error(f"获取A股{symbol}的信息时出错: {str(e)}")
        return {}

def convert_stock_code(code: str, market: str = "US") -> str:
    """
    转换股票代码为对应格式
    
    参数:
        code: 原始股票代码
        market: 市场类型，US、HK或CN
        
    返回:
        str: 转换后的股票代码或错误信息
    """
    # 清理代码（去除空格和特殊字符）
    code = code.strip().upper()
    
    # 处理A股
    if market == "CN":
        # 移除所有现有的后缀
        code = code.split('.')[0]
        
        # 处理数字代码
        if code.isdigit():
            # 上海证券交易所
            if code.startswith(('600', '601', '603', '605')):  # 上海主板
                return code + '.SH'
            elif code.startswith('688'):  # 科创板
                return code + '.SH'
            # 深圳证券交易所
            elif code.startswith('000'):  # 深圳主板
                return code + '.SZ'
            elif code.startswith('002'):  # 中小板
                return code + '.SZ'
            elif code.startswith(('300', '301')):  # 创业板
                return code + '.SZ'
            # 北京证券交易所
            elif code.startswith(('83', '84', '85', '86', '87', '88', '89')):
                return code + '.BJ'
            
        # 处理指数代码
        index_mapping = {
            '000001': '000001.SH',  # 上证指数
            '399001': '399001.SZ',  # 深证成指
            '399006': '399006.SZ',  # 创业板指
            '000688': '000688.SH',  # 科创50
            '000016': '000016.SH',  # 上证50
            '000300': '000300.SH',  # 沪深300
            '000905': '000905.SH',  # 中证500
            '000852': '000852.SH',  # 中证1000
        }
        
        if code in index_mapping:
            return index_mapping[code]
        
        # 处理其他格式
        # 处理带前缀的代码（如：sh600000、sz000001）
        if code.startswith(('SH', 'SZ', 'BJ')):
            market_prefix = code[:2]
            number = code[2:]
            if number.isdigit():
                return f"{number}.{market_prefix}"
        
        return {"valid": False, "reason": "无效的A股代码"}
    
    # 美股指数转换映射
    index_mapping = {
        '.DJI': '^DJI',
        '.IXIC': '^IXIC',
        '.SPX': '^GSPC',
        '.VIX': '^VIX',
        '.NDX': '^NDX'
    }
    
    # 处理美股
    if market == "US":
        # 处理指数
        if code in index_mapping:
            return index_mapping[code]
        
        # 处理期货合约
        if code.endswith(('main', '2503', '2504', '2505')) or re.match(r'[A-Z]+\d{4}$', code):
            return {"valid": False, "reason": "期货合约不支持导入"}
        
        # 处理富途/MOOMOO格式的美股代码（如US.AAPL）
        if code.startswith('US.'):
            return code[3:]
        
        # 处理雪球格式的美股代码（如$AAPL$）
        if code.startswith('$') and code.endswith('$'):
            return code[1:-1]
        
        # 普通美股代码直接返回
        return code.upper()
    
    # 处理港股
    if market == "HK":
        # 处理恒生指数
        if code == '800000':
            return '^HSI'
        
        # 处理富途/MOOMOO格式的港股代码（如HK.00700）
        if code.startswith('HK.'):
            code = code[3:]
        
        # 处理雪球格式的港股代码（如$00700$）
        if code.startswith('$') and code.endswith('$'):
            code = code[1:-1]
        
        # 移除前导零并添加.HK后缀
        return code.lstrip('0') + '.HK'
    
    return {"valid": False, "reason": "不支持的市场"}

def convert_index_code(code: str) -> str:
    """
    将常见指数代码和期货合约代码转换为YFinance可识别的格式
    
    参数:
        code: 原始代码
        
    返回:
        str: 转换后的代码
    """
    # 如果代码已经是YFinance格式，直接返回
    if code.startswith('^'):
        return code
        
    # 常见指数代码映射
    index_mapping = {
        # 美国指数
        ".DJI": "^DJI",     # 道琼斯工业平均指数
        ".IXIC": "^IXIC",   # 纳斯达克综合指数
        ".SPX": "^GSPC",    # 标普500指数
        ".VIX": "^VIX",     # VIX波动率指数
        ".NDX": "^NDX",     # 纳斯达克100指数
        ".RUT": "^RUT",     # 罗素2000指数
        "SPX": "^GSPC",     # 标普500指数简写
        "DJI": "^DJI",      # 道指简写
        "IXIC": "^IXIC",    # 纳指简写
        "VIX": "^VIX",      # VIX简写
        "NDX": "^NDX",      # 纳指100简写
        
        # 国际指数
        ".FTSE": "^FTSE",   # 英国富时100指数
        ".N225": "^N225",   # 日经225指数
        ".HSI": "^HSI",     # 恒生指数
        ".SSEC": "^SSEC",   # 上证综指
        ".SZSC": "^SZSC",   # 深证成指
        
        # 债券收益率
        ".TNX": "^TNX",     # 10年期美国国债收益率
        ".TYX": "^TYX",     # 30年期美国国债收益率
        
        # 商品
        "GCMAIN": "GC=F",   # 黄金期货
        "SIMAIN": "SI=F",   # 白银期货
        "CLMAIN": "CL=F",   # 原油期货
        "NGMAIN": "NG=F",   # 天然气期货
    }
    
    # 检查是否在映射表中
    if code in index_mapping:
        return index_mapping[code]
    
    # 处理期货合约代码
    # 例如：ES2503 -> ES=F (标普500期货)
    # 例如：NQ2503 -> NQ=F (纳斯达克期货)
    # 例如：GC2504 -> GC=F (黄金期货)
    futures_pattern = re.compile(r'^([A-Z]{2})(\d{4})$')
    match = futures_pattern.match(code)
    if match:
        futures_code = match.group(1)
        # 常见期货代码映射
        futures_mapping = {
            "ES": "ES=F",  # 标普500期货
            "NQ": "NQ=F",  # 纳斯达克期货
            "YM": "YM=F",  # 道琼斯期货
            "GC": "GC=F",  # 黄金期货
            "SI": "SI=F",  # 白银期货
            "CL": "CL=F",  # 原油期货
            "NG": "NG=F",  # 天然气期货
            "ZB": "ZB=F",  # 30年期美国国债期货
            "ZN": "ZN=F",  # 10年期美国国债期货
            "ZF": "ZF=F",  # 5年期美国国债期货
            "ZT": "ZT=F",  # 2年期美国国债期货
            "HG": "HG=F",  # 铜期货
            "PL": "PL=F",  # 铂金期货
            "PA": "PA=F",  # 钯金期货
            "ZC": "ZC=F",  # 玉米期货
            "ZS": "ZS=F",  # 大豆期货
            "ZW": "ZW=F",  # 小麦期货
            "KC": "KC=F",  # 咖啡期货
            "CT": "CT=F",  # 棉花期货
            "SB": "SB=F",  # 糖期货
            "CC": "CC=F",  # 可可期货
            "OJ": "OJ=F",  # 橙汁期货
            "LB": "LB=F",  # 木材期货
        }
        if futures_code in futures_mapping:
            return futures_mapping[futures_code]
    
    # 如果不在映射表中但以点开头，尝试转换为^格式
    if code.startswith("."):
        return "^" + code[1:]
    
    # 返回原始代码
    return code

def validate_stock_code(code: str, translate: bool = True) -> dict:
    """
    验证股票代码是否有效，并返回相关信息
    
    参数:
        code: 股票代码
        translate: 是否翻译股票名称为中文
        
    返回:
        dict: 包含验证结果的字典
    """
    try:
        # 去除空格和特殊字符
        code = code.strip().upper()
        
        # 如果代码为空，返回错误
        if not code:
            return {
                "code": "",
                "valid": False,
                "error": "股票代码不能为空"
            }
        
        # 检查是否为期货合约代码（如ES2503, NQ2503等）
        futures_pattern = re.compile(r'^([A-Z]{2})(\d{4})$')
        if futures_pattern.match(code):
            return {
                "code": code,
                "valid": False,
                "error": f"不支持期货合约代码，请使用普通股票代码"
            }
        
        # 检查是否为期货或期权
        if any(pattern in code for pattern in ["/", "=F", "-C", "-P"]):
            contract_type = "期货" if any(pattern in code for pattern in ["/", "=F"]) else "期权"
            return {
                "code": code,
                "valid": False,
                "error": f"不支持{contract_type}合约，请输入普通股票代码"
            }
        
        # 转换指数代码
        yf_code = convert_index_code(code)
        
        # 如果转换后的代码包含"=F"，说明是期货代码
        if "=F" in yf_code:
            return {
                "code": code,
                "valid": False,
                "error": f"不支持期货合约，请输入普通股票代码"
            }
        
        # 尝试获取股票信息
        try:
            stock_info = yf.Ticker(yf_code).info
            
            # 检查是否获取到有效信息
            if "symbol" not in stock_info or stock_info.get("regularMarketPrice") is None:
                return {
                    "code": code,
                    "valid": False,
                    "error": "无法获取股票信息，请检查代码是否正确"
                }
            
            # 检查市场类型
            market_type = stock_info.get("quoteType", "").lower()
            if market_type not in ["equity", "etf", "index"]:
                return {
                    "code": code,
                    "valid": False,
                    "error": f"不支持的市场类型: {market_type}，仅支持股票、ETF和指数"
                }
            
            # 获取股票名称
            english_name = stock_info.get("shortName", "") or stock_info.get("longName", "")
            
            # 获取中文名称（如果需要）
            chinese_name = ""
            if translate and english_name:
                chinese_name = get_chinese_name(yf_code, english_name)
            
            # 构建结果
            result = {
                "code": code,
                "yf_code": yf_code if yf_code != code else None,  # 如果代码被转换，记录YF代码
                "valid": True,
                "name": chinese_name if chinese_name and translate else english_name,
                "english_name": english_name,
                "price": stock_info.get("regularMarketPrice", 0),
                "currency": stock_info.get("currency", "USD"),
                "market_type": market_type
            }
            
            return result
        except Exception as e:
            error_msg = str(e)
            
            # 处理常见错误
            if "No data found" in error_msg or "404" in error_msg:
                return {
                    "code": code,
                    "valid": False,
                    "error": f"无法识别的股票代码: {code}"
                }
            elif "NoneType" in error_msg:
                return {
                    "code": code,
                    "valid": False,
                    "error": f"获取股票数据时出错: 数据格式不正确"
                }
            else:
                return {
                    "code": code,
                    "valid": False,
                    "error": f"获取股票数据时出错: {error_msg[:100]}"
                }
    
    except Exception as e:
        return {
            "code": code,
            "valid": False,
            "error": f"验证股票代码时出错: {str(e)[:100]}"
        }

def get_chinese_name(symbol: str, english_name: str) -> str:
    """
    获取股票的中文名称
    
    参数:
        symbol: 股票代码
        english_name: 英文名称
        
    返回:
        str: 中文名称，如果没有则返回空字符串
    """
    # 常见股票的中文名称映射
    chinese_names = {
        # 科技巨头
        "AAPL": "苹果公司",
        "MSFT": "微软公司",
        "GOOG": "谷歌",
        "GOOGL": "谷歌",
        "AMZN": "亚马逊",
        "META": "元宇宙平台",
        "TSLA": "特斯拉",
        "NVDA": "英伟达",
        "CRM": "赛富时",
        "ADBE": "奥多比",
        "ORCL": "甲骨文",
        "IBM": "国际商业机器",
        
        # 半导体与硬件
        "TSM": "台积电",
        "ASML": "阿斯麦",
        "AVGO": "博通",
        "QCOM": "高通",
        "AMD": "超威半导体",
        "INTC": "英特尔",
        "AMAT": "应用材料",
        "MU": "美光科技",
        "ARM": "ARM控股",
        "SNPS": "新思科技",
        "DELL": "戴尔科技",
        "WDC": "西部数据",
        "SONY": "索尼集团",
        "HPQ": "惠普",
        "LRCX": "泛林集团",
        "KLAC": "科磊",
        "TXN": "德州仪器",
        
        # 互联网与软件
        "PANW": "派拓网络",
        "NET": "云闪",
        "SPOT": "声田",
        "BILI": "哔哩哔哩",
        "NFLX": "奈飞",
        "COIN": "币安",
        "CSCO": "思科",
        "PLTR": "帕兰提尔",
        "EBAY": "易贝",
        "UBER": "优步",
        "SHOP": "Shopify",
        "NNOX": "纳诺克斯影像",
        "TEM": "Tempus AI",
        
        # 金融与支付
        "GS": "高盛集团",
        "MS": "摩根士丹利",
        "JPM": "摩根大通",
        "BLK": "贝莱德",
        "C": "花旗集团",
        "BAC": "美国银行",
        "WFC": "富国银行",
        "V": "维萨",
        "AXP": "美国运通",
        "PYPL": "贝宝",
        "SCHW": "嘉信理财",
        "COF": "第一资本金融",
        "UBS": "瑞银集团",
        "HSBC": "汇丰控股",
        "KKR": "KKR集团",
        "SMFG": "三井住友金融集团",
        "MCO": "穆迪公司",
        "MET": "大都会人寿",
        
        # 中概股
        "PDD": "拼多多",
        "BABA": "阿里巴巴",
        "JD": "京东",
        "NIO": "蔚来",
        "LI": "理想汽车",
        "TME": "腾讯音乐",
        "ZH": "知乎",
        
        # 能源与工业
        "XOM": "埃克森美孚",
        "CVX": "雪佛龙",
        "OXY": "西方石油",
        "CAT": "卡特彼勒",
        "BA": "波音",
        "LMT": "洛克希德马丁",
        "NOC": "诺斯罗普格鲁曼",
        "RTX": "雷神技术",
        "GE": "通用电气",
        "MMM": "3M公司",
        "GD": "通用动力",
        "F": "福特汽车",
        "BAESY": "BAE系统",
        "HII": "亨廷顿英格尔斯工业",
        "LHX": "L3哈里斯技术",
        
        # 医疗健康
        "JNJ": "强生",
        "LLY": "礼来",
        "PFE": "辉瑞",
        "MRK": "默克",
        "ABT": "雅培",
        "GILD": "吉利德科学",
        "NVO": "诺和诺德",
        "MDT": "美敦力",
        "AZN": "阿斯利康",
        "GSK": "葛兰素史克",
        "BSX": "波士顿科学",
        
        # 消费与服务
        "WMT": "沃尔玛",
        "COST": "好市多",
        "BBY": "百思买",
        "MCD": "麦当劳",
        "PG": "宝洁",
        "UL": "联合利华",
        "NKE": "耐克",
        "UAA": "安德玛",
        "ADDYY": "阿迪达斯",
        "KO": "可口可乐",
        "DIS": "迪士尼",
        "SBUX": "星巴克",
        "KHC": "卡夫亨氏",
        "KMB": "金佰利",
        "ABNB": "爱彼迎",
        "WMG": "华纳音乐集团",
        
        # 交通与物流
        "DAL": "达美航空",
        "ALK": "阿拉斯加航空",
        "UAL": "联合航空",
        "AAL": "美国航空",
        "DLAKY": "德国汉莎航空",
        "BKNG": "缤客控股",
        "MAR": "万豪国际",
        "FDX": "联邦快递",
        "UPS": "联合包裹服务",
        
        # 电信与通讯
        "TMUS": "T-Mobile美国",
        "T": "AT&T",
        "KDDIY": "KDDI公司",
        
        # 指数
        "^DJI": "道琼斯工业平均指数",
        "^IXIC": "纳斯达克综合指数",
        "^GSPC": "标普500指数",
        "^VIX": "芝加哥期权交易所波动率指数",
        "^NDX": "纳斯达克100指数",
        "^RUT": "罗素2000指数",
        "^TNX": "10年期美国国债收益率",
        "^TYX": "30年期美国国债收益率",
        "^FTSE": "富时100指数",
        "^N225": "日经225指数",
        "^HSI": "恒生指数",
        
        # ETF
        "SPY": "SPDR标普500ETF",
        "VOO": "先锋标普500ETF",
        "IVV": "iShares核心标普500ETF",
        "QQQ": "纳指100ETF",
        "QQQM": "Invesco纳斯达克100ETF",
        "QQQA": "ProShares纳斯达克100多策略ETF",
        "XLK": "SPDR科技行业ETF",
        "XLP": "SPDR必需消费品ETF",
        "XLY": "SPDR非必需消费品ETF",
        "KXI": "iShares全球必需消费品ETF",
        "PBJ": "Invesco食品饮料ETF",
        "GLD": "SPDR黄金信托",
        "UYG": "ProShares金融业2倍做多ETF",
        "FENY": "Fidelity能源行业ETF",
        "FTEC": "Fidelity信息技术ETF",
        "IBIT": "iShares比特币信托ETF",
        "XAR": "SPDR航空航天与国防ETF",
        "TLT": "iShares 20+年期国债ETF",
        "DBC": "Invesco商品指数追踪ETF",
        "ONEQ": "Fidelity纳斯达克综合指数ETF",
        "SHY": "iShares 1-3年期国债ETF",
        "SPLV": "Invesco标普500低波动ETF",
        
        # 其他
        "BRK.A": "伯克希尔哈撒韦A类",
        "BRK.B": "伯克希尔哈撒韦B类",
        "MSCI": "MSCI公司",
        "SFTBY": "软银集团"
    }
    
    # 检查是否有预定义的中文名称
    if symbol in chinese_names:
        return chinese_names[symbol]
    
    # 如果是中概股但没有预定义名称，尝试从英文名称推断
    if "China" in english_name or "Chinese" in english_name:
        return english_name
    
    # 尝试根据股票类型和名称特征进行翻译
    if symbol.startswith('^'):  # 指数
        if "Composite" in english_name:
            return english_name.replace("Composite", "综合") + "指数"
        elif "Index" in english_name:
            return english_name.replace("Index", "") + "指数"
        else:
            return english_name + "指数"
    
    # 尝试翻译ETF
    if "ETF" in english_name or "Fund" in english_name:
        # 提取ETF的主要特征
        if "S&P 500" in english_name:
            return "标普500" + ("ETF" if "ETF" in english_name else "基金")
        elif "NASDAQ" in english_name or "Nasdaq" in english_name:
            return "纳斯达克" + ("ETF" if "ETF" in english_name else "基金")
        elif "Technology" in english_name:
            return "科技行业" + ("ETF" if "ETF" in english_name else "基金")
        elif "Energy" in english_name:
            return "能源行业" + ("ETF" if "ETF" in english_name else "基金")
        elif "Financial" in english_name:
            return "金融行业" + ("ETF" if "ETF" in english_name else "基金")
        elif "Health" in english_name:
            return "医疗健康" + ("ETF" if "ETF" in english_name else "基金")
        elif "Consumer" in english_name:
            if "Staples" in english_name:
                return "必需消费品" + ("ETF" if "ETF" in english_name else "基金")
            elif "Discretionary" in english_name:
                return "非必需消费品" + ("ETF" if "ETF" in english_name else "基金")
            else:
                return "消费品" + ("ETF" if "ETF" in english_name else "基金")
    
    # 没有找到中文名称
    return ""

def categorize_stock(symbol: str, stock_type: str = "stock") -> str:
    """
    根据股票代码确定其分类
    
    参数:
        symbol: 股票代码
        stock_type: 股票类型（index或stock）
        
    返回:
        str: 股票分类
    """
    # 指数自动归类到"指数与ETF"
    if stock_type == "index" or symbol.startswith('^'):
        return "指数与ETF"
    
    # 遍历分类规则
    for category, patterns in STOCK_CATEGORIES.items():
        for pattern in patterns:
            if re.search(pattern, symbol):
                return category
    
    # 默认分类
    return "其他股票"

def batch_validate_stock_codes(codes: List[str], market: str = "US", translate: bool = False) -> List[Dict]:
    """
    批量验证股票代码
    
    参数:
        codes: 股票代码列表
        market: 市场类型，US或HK
        translate: 是否翻译股票名称为中文
        
    返回:
        List[Dict]: 验证结果列表
    """
    if not codes:
        logger.warning("批量验证股票代码时收到空列表")
        return []
    
    logger.info(f"开始批量验证 {len(codes)} 个股票代码，市场: {market}, 翻译: {translate}")
    results = []
    
    for code in codes:
        try:
            # 跳过空代码
            if not code or not code.strip():
                logger.warning("跳过空股票代码")
                results.append({
                    "code": "",
                    "valid": False,
                    "error": "股票代码不能为空"
                })
                continue
                
            # 验证单个股票代码
            logger.debug(f"验证股票代码: {code}")
            result = validate_stock_code(code, translate=translate)
            results.append(result)
            
            # 记录验证结果
            if result.get("valid", False):
                logger.debug(f"股票代码 {code} 验证有效")
            else:
                logger.debug(f"股票代码 {code} 验证无效: {result.get('error', '未知错误')}")
                
        except Exception as e:
            logger.error(f"验证股票代码 {code} 时出错: {str(e)}", exc_info=True)
            results.append({
                "code": code,
                "valid": False,
                "error": f"验证出错: {str(e)}"
            })
    
    # 记录验证结果统计
    valid_count = sum(1 for r in results if r.get("valid", False))
    logger.info(f"批量验证完成: 总计 {len(results)}, 有效 {valid_count}, 无效 {len(results) - valid_count}")
    
    return results

def parse_stock_text(text: str) -> List[str]:
    """
    解析股票文本，支持多种格式
    
    参数:
        text: 股票文本
        
    返回:
        List[str]: 解析出的股票代码列表
    """
    if not text:
        return []
    
    # 替换常见分隔符为空格
    text = re.sub(r'[,\t\n]+', ' ', text)
    
    # 分割并过滤空字符串
    codes = []
    for item in text.split():
        # 提取可能的股票代码
        # 支持多种格式：普通代码、富途格式(US.AAPL)、雪球格式($AAPL$)等
        code = item.strip()
        if code:
            codes.append(code)
    
    return codes

def update_watchlists_file(stocks: List[Dict], group_name: str = None) -> bool:
    """
    更新watchlists.json文件，支持自动分类
    
    参数:
        stocks: 股票列表，每个股票为一个字典，包含symbol, name, category等信息
        group_name: 分组名称，如果提供则所有股票放入该分组，否则按category自动分类
        
    返回:
        bool: 是否成功更新
    """
    try:
        # 读取现有的watchlists.json
        config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'config', 'watchlists.json')
        
        with open(config_path, 'r', encoding='utf-8') as f:
            watchlists = json.load(f)
        
        # 备份原文件
        backup_path = config_path + '.bak'
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(watchlists, f, ensure_ascii=False, indent=4)
        
        # 如果指定了分组名称，则所有股票放入该分组
        if group_name:
            # 创建新分组或清空现有分组
            watchlists[group_name] = {}
            
            # 添加股票到分组
            for stock in stocks:
                if stock.get('valid', False):
                    symbol = stock.get('converted', stock.get('symbol', ''))
                    name = stock.get('name', symbol)
                    if symbol:
                        watchlists[group_name][symbol] = name
        else:
            # 按category自动分类
            # 创建分类映射
            categorized_stocks = {}
            
            # 将股票按分类分组
            for stock in stocks:
                if stock.get('valid', False):
                    symbol = stock.get('converted', stock.get('symbol', ''))
                    name = stock.get('name', symbol)
                    category = stock.get('category', '其他股票')
                    
                    if symbol:
                        if category not in categorized_stocks:
                            categorized_stocks[category] = {}
                        categorized_stocks[category][symbol] = name
            
            # 更新watchlists
            for category, stocks_dict in categorized_stocks.items():
                if category in watchlists:
                    # 合并到现有分类
                    watchlists[category].update(stocks_dict)
                else:
                    # 创建新分类
                    watchlists[category] = stocks_dict
        
        # 写入更新后的文件
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(watchlists, f, ensure_ascii=False, indent=4)
            
        return True
    except Exception as e:
        logger.error(f"更新watchlists.json文件时出错: {str(e)}")
        return False

def import_stocks_to_watchlist(user_id: str, stocks: List[Dict], group_name: str = "", auto_categories: bool = False, clear_existing: bool = False) -> Dict:
    """
    导入股票到自选股列表
    
    参数:
        user_id: 用户ID
        stocks: 股票列表，每个股票是一个字典，包含code和name
        group_name: 分组名称，如果不指定则使用默认分组
        auto_categories: 是否自动分类
        clear_existing: 是否清空现有列表
        
    返回:
        Dict: 导入结果
    """
    try:
        # 获取现有的自选股列表
        user_watchlists = get_user_watchlists(user_id) if not clear_existing else {}
        
        # 如果指定了分组名称且不是自动分类，确保分组存在
        if group_name and not auto_categories:
            if group_name not in user_watchlists:
                user_watchlists[group_name] = {}
        
        # 统计导入结果
        imported_count = 0
        skipped_count = 0
        invalid_count = 0
        
        # 过滤有效的股票
        valid_stocks = [s for s in stocks if s.get('valid', True)]
        
        # 根据是否自动分类处理
        if auto_categories:
            # 自动分类股票
            categorized_stocks = {}
            
            for stock in valid_stocks:
                stock_code = stock.get('code', '')
                if not stock_code:
                    continue
                
                # 使用简单字符串格式保存股票名称
                stock_name = stock.get('name', '')
                
                # 获取股票类型
                market_type = stock.get('market_type', 'equity').lower()
                
                # 确保指数代码使用正确的格式
                if stock_code.startswith('.') or (market_type == 'index' and not stock_code.startswith('^')):
                    # 使用convert_index_code函数转换指数代码
                    stock_code = convert_index_code(stock_code)
                
                # 使用智能分类逻辑
                if market_type == 'index' or stock_code.startswith('^'):
                    # 指数自动归类到"指数与ETF"
                    category = "指数与ETF"
                elif market_type == 'etf':
                    # ETF自动归类到"指数与ETF"
                    category = "指数与ETF"
                else:
                    # 使用STOCK_CATEGORIES进行智能行业分类
                    category = None
                    for cat_name, patterns in STOCK_CATEGORIES.items():
                        for pattern in patterns:
                            if re.search(pattern, stock_code):
                                category = cat_name
                                break
                        if category:
                            break
                    
                    # 如果没有匹配到任何分类，使用默认分类
                    if not category:
                        category = '无分类自选股'
                
                # 添加到分类中
                if category not in categorized_stocks:
                    categorized_stocks[category] = {}
                
                # 添加股票到分类
                categorized_stocks[category][stock_code] = stock_name
                
                imported_count += 1
            
            # 更新用户自选股列表
            for category, stocks_dict in categorized_stocks.items():
                if category not in user_watchlists:
                    user_watchlists[category] = {}
                
                # 合并股票
                user_watchlists[category].update(stocks_dict)
        else:
            # 使用指定的分组名称
            target_group = group_name or "自选股"
            
            # 确保分组存在
            if target_group not in user_watchlists:
                user_watchlists[target_group] = {}
            
            # 添加股票到分组
            for stock in valid_stocks:
                stock_code = stock.get('code', '')
                if not stock_code:
                    continue
                
                # 使用简单字符串格式保存股票名称
                stock_name = stock.get('name', '')
                
                # 获取股票类型
                market_type = stock.get('market_type', 'equity').lower()
                
                # 确保指数代码使用正确的格式
                if stock_code.startswith('.') or (market_type == 'index' and not stock_code.startswith('^')):
                    # 使用convert_index_code函数转换指数代码
                    stock_code = convert_index_code(stock_code)
                
                # 添加到分组
                user_watchlists[target_group][stock_code] = stock_name
                
                imported_count += 1
        
        # 保存更新后的自选股列表
        save_user_watchlists(user_id, user_watchlists)
        
        # 返回结果
        return {
            'success': True,
            'imported': imported_count,
            'skipped': skipped_count,
            'invalid': invalid_count,
            'watchlists': user_watchlists
        }
    
    except Exception as e:
        logger.error(f"导入股票到自选股列表出错: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def get_user_watchlists(user_id: str) -> Dict:
    """
    获取用户的自选股列表
    
    参数:
        user_id: 用户ID
        
    返回:
        Dict: 用户的自选股列表
    """
    try:
        # 获取项目根目录
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        
        # 获取用户配置目录
        user_config_dir = os.path.join(project_root, 'config', 'users', user_id)
        
        # 确保目录存在
        os.makedirs(user_config_dir, exist_ok=True)
        
        # 自选股文件路径
        watchlists_file = os.path.join(user_config_dir, 'watchlists.json')
        
        # 如果用户特定的文件不存在，返回空字典
        if not os.path.exists(watchlists_file):
            return {}
        
        # 读取用户特定的文件
        with open(watchlists_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    except Exception as e:
        logger.error(f"获取用户自选股列表时出错: {str(e)}")
        return {}

def save_user_watchlists(user_id: str, watchlists: Dict) -> bool:
    """
    保存用户的自选股列表
    
    参数:
        user_id: 用户ID
        watchlists: 自选股列表
        
    返回:
        bool: 是否成功保存
    """
    try:
        # 获取项目根目录
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        
        # 获取用户配置目录
        user_config_dir = os.path.join(project_root, 'config', 'users', user_id)
        
        # 确保目录存在
        os.makedirs(user_config_dir, exist_ok=True)
        
        # 自选股文件路径
        watchlists_file = os.path.join(user_config_dir, 'watchlists.json')
        
        # 保存文件
        with open(watchlists_file, 'w', encoding='utf-8') as f:
            json.dump(watchlists, f, ensure_ascii=False, indent=4)
        
        return True
    
    except Exception as e:
        logger.error(f"保存用户自选股列表时出错: {str(e)}")
        return False 