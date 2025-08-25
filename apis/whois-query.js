const express = require('express');
const router = express.Router();
const net = require('net');
const NodeCache = require('node-cache');

const plugin_info = {
    "name": "whois 查询",
    "version": "v1.0",
    "avatar": "Yunmoan"
}

console.log("+ 模块: " + plugin_info.name + " - " + plugin_info.version + " (作者: " + plugin_info.avatar + ") 已载入数据.")

// 创建缓存实例，缓存时间设置为1小时
const cache = new NodeCache({ stdTTL: 3600 });

// WHOIS服务器配置
const WHOIS_SERVERS = {
    // 域名WHOIS服务器
    'cn': 'whois.cnnic.cn',
    'com': 'whois.verisign-grs.com',
    'net': 'whois.verisign-grs.com',
    'org': 'whois.pir.org',
    'info': 'whois.afilias.net',
    'biz': 'whois.biz',
    'cc': 'whois.nic.cc',
    'tv': 'whois.nic.tv',
    'me': 'whois.nic.me',
    'io': 'whois.nic.io',
    'co': 'whois.nic.co',
    'ai': 'whois.nic.ai',
    'app': 'whois.nic.google',
    'dev': 'whois.nic.google',
    'cloud': 'whois.nic.google',
    'default': 'whois.iana.org'
};

// IP地址和ASN WHOIS服务器
const IP_ASN_SERVERS = {
    'arin': 'whois.arin.net',      // 北美地区
    'ripe': 'whois.ripe.net',      // 欧洲地区
    'apnic': 'whois.apnic.net',    // 亚太地区
    'lacnic': 'whois.lacnic.net',  // 拉丁美洲
    'afrinic': 'whois.afrinic.net' // 非洲地区
};

// 获取域名WHOIS服务器
function getWhoisServer(domain) {
    const tld = domain.split('.').pop().toLowerCase();
    return WHOIS_SERVERS[tld] || WHOIS_SERVERS['default'];
}

// 获取IP地址和ASN的WHOIS服务器
function getIpAsnWhoisServer(query) {
    // 如果是ASN查询
    if (query.toUpperCase().startsWith('AS')) {
        return IP_ASN_SERVERS['apnic']; // 默认使用APNIC
    }
    
    // 如果是IP地址，根据IP范围选择服务器
    if (isValidIP(query)) {
        const ipParts = query.split('.');
        const firstOctet = parseInt(ipParts[0]);
        
        if (firstOctet >= 1 && firstOctet <= 126) {
            return IP_ASN_SERVERS['arin'];      // A类地址
        } else if (firstOctet >= 128 && firstOctet <= 191) {
            return IP_ASN_SERVERS['arin'];      // B类地址
        } else if (firstOctet >= 192 && firstOctet <= 223) {
            return IP_ASN_SERVERS['arin'];      // C类地址
        } else if (firstOctet >= 224 && firstOctet <= 239) {
            return IP_ASN_SERVERS['arin'];      // D类地址
        } else if (firstOctet >= 240 && firstOctet <= 255) {
            return IP_ASN_SERVERS['arin'];      // E类地址
        }
    }
    
    return IP_ASN_SERVERS['apnic']; // 默认
}

// 执行WHOIS查询
function queryWhois(domain, server) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let data = '';
        
        client.setTimeout(10000); // 10秒超时
        
        client.connect(43, server, () => {
            client.write(domain + '\r\n');
        });
        
        client.on('data', (chunk) => {
            data += chunk.toString();
        });
        
        client.on('end', () => {
            client.destroy();
            resolve(data);
        });
        
        client.on('error', (err) => {
            client.destroy();
            reject(err);
        });
        
        client.on('timeout', () => {
            client.destroy();
            reject(new Error('查询超时'));
        });
    });
}

// 解析WHOIS响应数据
function parseWhoisData(rawData, domain) {
    const lines = rawData.split('\n');
    const result = {
        domain: domain,
        registrant: '',
        email: '',
        registrar: '',
        registration_date: '',
        expiration_date: '',
        status: '',
        nameservers: [],
        dnssec: '',
        roid: '',
        raw_data: rawData
    };
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('%') || line.startsWith('#')) continue;
        
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        
        switch (key) {
            case 'registrant':
            case 'registrant name':
                result.registrant = value;
                break;
            case 'registrant contact email':
            case 'registrant email':
            case 'admin email':
                result.email = value;
                break;
            case 'sponsoring registrar':
            case 'registrar':
            case 'registrar name':
                result.registrar = value;
                break;
            case 'registration time':
            case 'created date':
            case 'created':
                result.registration_date = value;
                break;
            case 'expiration time':
            case 'expiration date':
            case 'expires':
                result.expiration_date = value;
                break;
            case 'domain status':
            case 'status':
                if (value) {
                    result.status = value.replace(/^ok/i, '正常').replace(/^clienttransferprohibited/i, '禁止转移');
                }
                break;
            case 'name server':
            case 'nserver':
                if (value && !result.nameservers.includes(value)) {
                    result.nameservers.push(value);
                }
                break;
            case 'dnssec':
                result.dnssec = value;
                break;
            case 'roid':
                result.roid = value;
                break;
        }
    }
    
    // 增强解析，处理更多字段
    const additionalInfo = extractAdditionalInfo(rawData);
    Object.assign(result, additionalInfo);
    
    return result;
}

// 提取额外信息
function extractAdditionalInfo(rawData) {
    const info = {};
    const lines = rawData.split('\n');
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('%') || line.startsWith('#')) continue;
        
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        
        // 处理更多字段
        if (key.includes('phone') || key.includes('tel')) {
            info.phone = value;
        } else if (key.includes('address') || key.includes('addr')) {
            info.address = value;
        } else if (key.includes('organization') || key.includes('org')) {
            info.organization = value;
        } else if (key.includes('updated') || key.includes('modified')) {
            info.last_updated = value;
        } else if (key.includes('admin') && key.includes('email')) {
            info.admin_email = value;
        } else if (key.includes('tech') && key.includes('email')) {
            info.tech_email = value;
        } else if (key.includes('billing') && key.includes('email')) {
            info.billing_email = value;
        }
    }
    
    return info;
}

// 解析IP地址和ASN的WHOIS数据
function parseIpAsnWhoisData(rawData, query) {
    const lines = rawData.split('\n');
    const result = {
        query: query,
        type: isValidIP(query) ? 'ip' : 'asn',
        organization: '',
        description: '',
        country: '',
        admin_contact: '',
        tech_contact: '',
        abuse_contact: '',
        created_date: '',
        last_updated: '',
        status: '',
        raw_data: rawData
    };
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('%') || line.startsWith('#')) continue;
        
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        
        switch (key) {
            case 'organization':
            case 'org':
            case 'org-name':
                result.organization = value;
                break;
            case 'description':
            case 'descr':
                result.description = value;
                break;
            case 'country':
            case 'country-code':
                result.country = value;
                break;
            case 'admin-c':
            case 'admin-contact':
                result.admin_contact = value;
                break;
            case 'tech-c':
            case 'tech-contact':
                result.tech_contact = value;
                break;
            case 'abuse-c':
            case 'abuse-mailbox':
                result.abuse_contact = value;
                break;
            case 'created':
            case 'created-date':
                result.created_date = value;
                break;
            case 'last-modified':
            case 'updated':
                result.last_updated = value;
                break;
            case 'status':
                result.status = value;
                break;
        }
    }
    
    return result;
}

// 验证域名格式
function isValidDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain);
}

// 验证IP地址格式
function isValidIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// 验证ASN格式
function isValidASN(asn) {
    const asnRegex = /^AS\d+$/i;
    return asnRegex.test(asn);
}

// 主查询接口
router.get('/', async (req, res) => {
    try {
        const { domain, ip, asn } = req.query;
        
        // 确定查询类型和内容
        let queryType = '';
        let queryContent = '';
        
        if (domain) {
            queryType = 'domain';
            queryContent = domain;
        } else if (ip) {
            queryType = 'ip';
            queryContent = ip;
        } else if (asn) {
            queryType = 'asn';
            queryContent = asn;
        } else {
            return res.status(400).json({
                success: false,
                error: "请提供查询参数: domain、ip 或 asn",
                usage: {
                    domain: "/whois-query?domain=zyghit.cn",
                    ip: "/whois-query?ip=8.8.8.8",
                    asn: "/whois-query?asn=AS15169",
                    description: "查询域名、IP地址或ASN的WHOIS注册信息"
                },
                timestamp: new Date().toISOString()
            });
        }
        
        // 验证查询内容格式
        let isValid = false;
        if (queryType === 'domain') {
            isValid = isValidDomain(queryContent);
        } else if (queryType === 'ip') {
            isValid = isValidIP(queryContent);
        } else if (queryType === 'asn') {
            isValid = isValidASN(queryContent);
        }
        
        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: `无效的${queryType === 'domain' ? '域名' : queryType === 'ip' ? 'IP地址' : 'ASN'}格式`,
                timestamp: new Date().toISOString()
            });
        }
        
        // 检查缓存
        const cacheKey = `whois_${queryType}_${queryContent}`;
        const cachedResult = cache.get(cacheKey);
        if (cachedResult) {
            console.log(`~ [${plugin_info.name}] 命中缓存: ${queryContent}`);
            return res.json({
                success: true,
                data: cachedResult,
                query: {
                    type: queryType,
                    content: queryContent,
                    whois_server: cachedResult.whois_server,
                    from_cache: true
                },
                timestamp: new Date().toISOString()
            });
        }
        
        // 获取WHOIS服务器
        let whoisServer;
        if (queryType === 'domain') {
            whoisServer = getWhoisServer(queryContent);
        } else {
            whoisServer = getIpAsnWhoisServer(queryContent);
        }
        
        console.log(`~ [${plugin_info.name}] 查询${queryType}: ${queryContent}, WHOIS服务器: ${whoisServer}`);
        
        const rawData = await queryWhois(queryContent, whoisServer);
        
        let result;
        if (queryType === 'domain') {
            const parsedData = parseWhoisData(rawData, queryContent);
            
            // 计算续费年限
            let renewalYears = 0;
            if (parsedData.registration_date && parsedData.expiration_date) {
                try {
                    const regDate = new Date(parsedData.registration_date);
                    const expDate = new Date(parsedData.expiration_date);
                    if (!isNaN(regDate.getTime()) && !isNaN(expDate.getTime())) {
                        renewalYears = Math.ceil((expDate.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
                    }
                } catch (e) {
                    // 日期解析失败，忽略
                }
            }
            
            result = {
                ...parsedData,
                renewal_years: renewalYears,
                whois_server: whoisServer,
                query_time: new Date().toISOString()
            };
        } else {
            // IP或ASN查询
            result = {
                ...parseIpAsnWhoisData(rawData, queryContent),
                whois_server: whoisServer,
                query_time: new Date().toISOString()
            };
        }
        
        // 存入缓存
        cache.set(cacheKey, result);
        console.log(`~ [${plugin_info.name}] 已缓存结果: ${queryContent}`);
        
        res.json({
            success: true,
            data: result,
            query: {
                type: queryType,
                content: queryContent,
                whois_server: whoisServer,
                from_cache: false
            },
            timestamp: new Date().toISOString()
        });
        
        console.log("~ [" + plugin_info.name + "] 已处理请求: " + queryContent);
    } catch (error) {
        console.error("~ [" + plugin_info.name + "] 错误: " + error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 批量查询接口
router.post('/batch', async (req, res) => {
    try {
        const { domains = [], ips = [], asns = [] } = req.body;
        
        if (domains.length === 0 && ips.length === 0 && asns.length === 0) {
            return res.status(400).json({
                success: false,
                error: "请提供查询列表",
                timestamp: new Date().toISOString()
            });
        }
        
        const totalQueries = domains.length + ips.length + asns.length;
        if (totalQueries > 20) {
            return res.status(400).json({
                success: false,
                error: "批量查询最多支持20个查询项",
                timestamp: new Date().toISOString()
            });
        }
        
        const results = [];
        const errors = [];
        
        // 批量查询域名
        for (const domain of domains) {
            if (isValidDomain(domain)) {
                try {
                    const whoisServer = getWhoisServer(domain);
                    const rawData = await queryWhois(domain, whoisServer);
                    const parsedData = parseWhoisData(rawData, domain);
                    
                    // 计算续费年限
                    let renewalYears = 0;
                    if (parsedData.registration_date && parsedData.expiration_date) {
                        try {
                            const regDate = new Date(parsedData.registration_date);
                            const expDate = new Date(parsedData.expiration_date);
                            if (!isNaN(regDate.getTime()) && !isNaN(expDate.getTime())) {
                                renewalYears = Math.ceil((expDate.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
                            }
                        } catch (e) {
                            // 日期解析失败，忽略
                        }
                    }
                    
                    results.push({
                        ...parsedData,
                        renewal_years: renewalYears,
                        whois_server: whoisServer,
                        query_time: new Date().toISOString(),
                        query_type: 'domain'
                    });
                } catch (error) {
                    errors.push({
                        query: domain,
                        type: 'domain',
                        error: error.message
                    });
                }
            } else {
                errors.push({
                    query: domain,
                    type: 'domain',
                    error: "无效的域名格式"
                });
            }
        }
        
        // 批量查询IP地址
        for (const ip of ips) {
            if (isValidIP(ip)) {
                try {
                    const whoisServer = getIpAsnWhoisServer(ip);
                    const rawData = await queryWhois(ip, whoisServer);
                    const parsedData = parseIpAsnWhoisData(rawData, ip);
                    
                    results.push({
                        ...parsedData,
                        whois_server: whoisServer,
                        query_time: new Date().toISOString(),
                        query_type: 'ip'
                    });
                } catch (error) {
                    errors.push({
                        query: ip,
                        type: 'ip',
                        error: error.message
                    });
                }
            } else {
                errors.push({
                    query: ip,
                    type: 'ip',
                    error: "无效的IP地址格式"
                });
            }
        }
        
        // 批量查询ASN
        for (const asn of asns) {
            if (isValidASN(asn)) {
                try {
                    const whoisServer = getIpAsnWhoisServer(asn);
                    const rawData = await queryWhois(asn, whoisServer);
                    const parsedData = parseIpAsnWhoisData(rawData, asn);
                    
                    results.push({
                        ...parsedData,
                        whois_server: whoisServer,
                        query_time: new Date().toISOString(),
                        query_type: 'asn'
                    });
                } catch (error) {
                    errors.push({
                        query: asn,
                        type: 'asn',
                        error: error.message
                    });
                }
            } else {
                errors.push({
                    query: asn,
                    type: 'asn',
                    error: "无效的ASN格式"
                });
            }
        }
        
        res.json({
            success: true,
            data: {
                results: results,
                errors: errors,
                summary: {
                    total: totalQueries,
                    successful: results.length,
                    failed: errors.length,
                    domains: domains.length,
                    ips: ips.length,
                    asns: asns.length
                }
            },
            timestamp: new Date().toISOString()
        });
        
        console.log("~ [" + plugin_info.name + "] 已处理批量请求: " + totalQueries + " 个查询项");
    } catch (error) {
        console.error("~ [" + plugin_info.name + "] 批量查询错误: " + error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 健康检查接口
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: plugin_info.name,
        version: plugin_info.version,
        status: "healthy",
        supported_types: {
            domains: Object.keys(WHOIS_SERVERS),
            ip_asn: Object.keys(IP_ASN_SERVERS)
        },
        cache_stats: {
            keys: cache.keys().length,
            ttl: cache.getTtl(),
            hits: cache.getStats().hits,
            misses: cache.getStats().misses
        },
        timestamp: new Date().toISOString()
    });
});

// 缓存管理接口
router.get('/cache/clear', (req, res) => {
    cache.flushAll();
    res.json({
        success: true,
        message: "缓存已清空",
        timestamp: new Date().toISOString()
    });
});

router.get('/cache/stats', (req, res) => {
    res.json({
        success: true,
        cache_stats: {
            keys: cache.keys().length,
            ttl: cache.getTtl(),
            hits: cache.getStats().hits,
            misses: cache.getStats().misses
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
